// ============================================================
// ROUTES — /api/massa (cadastro em massa CSV/XLSX)
// ============================================================
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const motor = require('../services/motor');
const bling = require('../services/bling');
const gemini = require('../services/gemini');

// Upload em memória
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const tipos = ['text/csv', 'application/vnd.ms-excel', 'text/plain',
                   'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    const extOk = /\.(csv|xlsx|xls|txt)$/i.test(file.originalname);
    if (extOk) cb(null, true);
    else cb(new Error('Apenas .csv, .xlsx, .xls são aceitos'));
  }
});

// ------------------------------------------------------------
// POST /api/massa/upload — Upload e parsing do CSV
// ------------------------------------------------------------
router.post('/upload', upload.single('planilha'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo enviado' });

    const conteudo = req.file.buffer.toString('utf-8');

    // Parse CSV
    let registros;
    try {
      registros = parse(conteudo, {
        columns: true,        // usa primeira linha como header
        skip_empty_lines: true,
        trim: true,
        delimiter: [',', ';'] // aceita vírgula ou ponto-e-vírgula
      });
    } catch (e) {
      return res.status(400).json({ erro: 'Erro ao ler CSV: ' + e.message });
    }

    if (registros.length === 0) return res.status(400).json({ erro: 'CSV vazio' });

    // Normaliza campos (aceita variações de nome de coluna)
    const normalizar = (r) => {
      const get = (...keys) => {
        for (const k of keys) {
          const val = r[k] || r[k.toLowerCase()] || r[k.toUpperCase()];
          if (val) return val;
        }
        return '';
      };

      return {
        nome: get('nome', 'Nome', 'NOME', 'descricao', 'Descricao', 'produto'),
        oem: get('oem', 'OEM', 'codigo_oem', 'cod_oem', 'mpn', 'MPN', 'codigo_mae'),
        sku: get('sku', 'SKU', 'codigo', 'Codigo', 'referencia', 'REF'),
        ncm: get('ncm', 'NCM', 'cod_ncm'),
        ean: get('ean', 'EAN', 'gtin', 'GTIN', 'codigo_barras'),
        preco: get('preco', 'Preco', 'PRECO', 'valor', 'price'),
        estoque: get('estoque', 'Estoque', 'quantidade', 'qtd'),
        aplicacao: get('aplicacao', 'Aplicacao', 'veiculo', 'compatibilidade'),
        categoria: get('categoria', 'Categoria', 'cat'),
        marca: get('marca', 'Marca', 'brand') || process.env.MARCA_PADRAO || 'TRIMGO',
        peso_bruto: get('peso', 'Peso', 'peso_bruto', 'weight'),
        raw: r
      };
    };

    const produtos = registros.map(normalizar);

    // Processa NCT de cada produto
    const processados = produtos.map(p => ({
      ...motor.processarProduto(p),
      linha_original: p.raw
    }));

    const resumo = {
      total: processados.length,
      aprovados: processados.filter(p => p.decisao === 'APROVADO').length,
      pendentes: processados.filter(p => p.decisao === 'PENDENTE').length,
      bloqueados: processados.filter(p => p.decisao === 'BLOQUEADO').length
    };

    res.json({
      ok: true,
      arquivo: req.file.originalname,
      resumo,
      produtos: processados.slice(0, 100) // retorna max 100 no preview
    });

  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ------------------------------------------------------------
// POST /api/massa/enviar-bling — Envia lote aprovado para Bling
// ------------------------------------------------------------
router.post('/enviar-bling', async (req, res) => {
  try {
    const { produtos } = req.body;
    if (!Array.isArray(produtos) || produtos.length === 0) {
      return res.status(400).json({ erro: 'Envie array "produtos"' });
    }

    const resultados = [];
    let criados = 0, erros = 0;

    for (const p of produtos) {
      // Só envia aprovados ou forçados
      if (p.decisao === 'BLOQUEADO' && !p.forcar) {
        resultados.push({ sku: p.sku, status: 'ignorado', motivo: 'NCT bloqueado' });
        continue;
      }

      const result = await bling.criarProduto(p);
      if (result.ok) {
        criados++;
        resultados.push({ sku: p.sku, status: 'criado', id_bling: result.data?.data?.id });
      } else {
        erros++;
        resultados.push({ sku: p.sku, status: 'erro', detalhes: result.error });
      }

      // Delay para não sobrecarregar API Bling
      await new Promise(r => setTimeout(r, 200));
    }

    res.json({
      ok: true,
      criados,
      erros,
      total: produtos.length,
      resultados
    });

  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ------------------------------------------------------------
// POST /api/massa/enriquecer-lote — Enriquece vários com Gemini
// ------------------------------------------------------------
router.post('/enriquecer-lote', async (req, res) => {
  const { produtos } = req.body;
  if (!Array.isArray(produtos)) return res.status(400).json({ erro: 'Envie array "produtos"' });

  if (produtos.length > 20) {
    return res.status(400).json({ erro: 'Máx 20 produtos por chamada para evitar rate limit Gemini' });
  }

  const resultados = await gemini.enriquecerLote(produtos);
  res.json({ ok: true, total: resultados.length, resultados });
});

module.exports = router;
