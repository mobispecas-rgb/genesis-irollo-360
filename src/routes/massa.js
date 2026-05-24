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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const extOk = /\.(csv|xlsx|xls|txt)$/i.test(file.originalname);
    if (extOk) cb(null, true);
    else cb(new Error('Apenas .csv, .xlsx, .xls são aceitos'));
  }
});

router.post('/upload', upload.single('planilha'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo enviado' });
    const conteudo = req.file.buffer.toString('utf-8');
    let registros;
    try {
      registros = parse(conteudo, { columns: true, skip_empty_lines: true, trim: true, delimiter: [',', ';'] });
    } catch (e) { return res.status(400).json({ erro: 'Erro ao ler CSV: ' + e.message }); }
    if (registros.length === 0) return res.status(400).json({ erro: 'CSV vazio' });
    const normalizar = (r) => {
      const get = (...keys) => { for (const k of keys) { const val = r[k] || r[k.toLowerCase()] || r[k.toUpperCase()]; if (val) return val; } return ''; };
      return { nome: get('nome','Nome','descricao'), oem: get('oem','OEM','mpn','MPN'), sku: get('sku','SKU','codigo','referencia'), ncm: get('ncm','NCM'), ean: get('ean','EAN','gtin'), preco: get('preco','valor','price'), estoque: get('estoque','quantidade','qtd'), aplicacao: get('aplicacao','veiculo','compatibilidade'), categoria: get('categoria','cat'), marca: get('marca','brand') || process.env.MARCA_PADRAO || 'TRIMGO', peso_bruto: get('peso','peso_bruto'), raw: r };
    };
    const processados = registros.map(normalizar).map(p => ({ ...motor.processarProduto(p), linha_original: p.raw }));
    const resumo = { total: processados.length, aprovados: processados.filter(p => p.decisao === 'APROVADO').length, pendentes: processados.filter(p => p.decisao === 'PENDENTE').length, bloqueados: processados.filter(p => p.decisao === 'BLOQUEADO').length };
    res.json({ ok: true, arquivo: req.file.originalname, resumo, produtos: processados.slice(0, 100) });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.post('/enviar-bling', async (req, res) => {
  try {
    const { produtos } = req.body;
    if (!Array.isArray(produtos) || produtos.length === 0) return res.status(400).json({ erro: 'Envie array "produtos"' });
    const resultados = [];
    let criados = 0, erros = 0;
    for (const p of produtos) {
      if (p.decisao === 'BLOQUEADO' && !p.forcar) { resultados.push({ sku: p.sku, status: 'ignorado', motivo: 'NCT bloqueado' }); continue; }
      const result = await bling.criarProduto(p);
      if (result.ok) { criados++; resultados.push({ sku: p.sku, status: 'criado', id_bling: result.data?.data?.id }); }
      else { erros++; resultados.push({ sku: p.sku, status: 'erro', detalhes: result.error }); }
      await new Promise(r => setTimeout(r, 200));
    }
    res.json({ ok: true, criados, erros, total: produtos.length, resultados });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.post('/enriquecer-lote', async (req, res) => {
  const { produtos } = req.body;
  if (!Array.isArray(produtos)) return res.status(400).json({ erro: 'Envie array "produtos"' });
  if (produtos.length > 20) return res.status(400).json({ erro: 'Máx 20 produtos por chamada' });
  const resultados = await gemini.enriquecerLote(produtos);
  res.json({ ok: true, total: resultados.length, resultados });
});

module.exports = router;
