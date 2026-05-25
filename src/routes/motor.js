// ============================================================
// ROUTES — /api/motor (NCT, RAST-HASH, Enriquecimento)
// ============================================================
const express = require('express');
const router = express.Router();
const motor = require('../services/motor');
const gemini = require('../services/gemini');

// POST /api/motor/nct — Calcular NCT de um produto
router.post('/nct', (req, res) => {
  try {
    const resultado = motor.calcularNCT(req.body);
    res.json({ ok: true, ...resultado });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// POST /api/motor/processar — Processar produto completo
router.post('/processar', (req, res) => {
  try {
    const processado = motor.processarProduto(req.body);
    res.json({ ok: true, produto: processado });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// POST /api/motor/hash — Gerar RAST-HASH
router.post('/hash', (req, res) => {
  const { sku, oem, empresa } = req.body;
  if (!sku && !oem) return res.status(400).json({ erro: 'SKU ou OEM obrigatório' });
  const hash = motor.gerarRastHash(sku, oem, empresa || 'MOBIS');
  res.json({ ok: true, rast_hash: hash, input: `md5(${sku}+${oem}+${empresa||'MOBIS'})[:16]` });
});

// POST /api/motor/enriquecer — Enriquecer produto via Claude Haiku
router.post('/enriquecer', async (req, res) => {
  try {
    const enrich = await gemini.enriquecerProduto(req.body);
    if (!enrich.ok) return res.status(500).json({ erro: enrich.erro, parcial: enrich.dados_parciais });

    const d = enrich.dados;

    // Mapeamento correto: campos enriquecidos → campos do NCT
    // nome_enriquecido → nome | ncm_sugerido → ncm | aplicacao_veicular → aplicacao
    const dadosParaNCT = {
      oem:      req.body.oem  || req.body.codigo,
      sku:      req.body.sku,
      ean:      req.body.ean  || (d.cruzamento && d.cruzamento.ean_codigos && d.cruzamento.ean_codigos[0]),
      nome:     d.nome_enriquecido || req.body.nome,
      ncm:      d.ncm_sugerido    || req.body.ncm,
      aplicacao: d.aplicacao_veicular,
      peso_bruto: d.peso_estimado_kg,
      // Passa confiança da IA para o motor penalizar TF quando necessário
      confianca_ia:  d.confianca_enriquecimento || 0.5,
      dados_reais:   enrich.fonte_real || false,
      codigos_equivalentes_count: (d.cruzamento && d.cruzamento.codigos_equivalentes && d.cruzamento.codigos_equivalentes.length) || 0
    };

    const nctCalc = motor.calcularNCT(dadosParaNCT);

    res.json({
      ok: true,
      enriquecimento: d,
      nct: nctCalc.nct,
      nct_componentes: nctCalc.componentes,   // ← FIX: retorna componentes para as barras
      decisao: nctCalc.decisao,
      rast_hash: nctCalc.rast_hash,
      modelo_ia: enrich.modelo_usado,
      fonte_real: enrich.fonte_real || false
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// POST /api/motor/cruzar — Cruzamento real de códigos OEM/EAN/SKU
router.post('/cruzar', async (req, res) => {
  try {
    const { codigo, marca } = req.body;
    if (!codigo) return res.status(400).json({ erro: 'Informe o campo "codigo"' });
    const resultado = await gemini.cruzarCodigos(codigo, marca || '');
    if (!resultado.ok) return res.status(500).json({ erro: resultado.erro });
    res.json({ ok: true, ...resultado });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// POST /api/motor/titulo — Gerar título Full-Match SEO
router.post('/titulo', async (req, res) => {
  try {
    const resultado = await gemini.gerarTituloSEO(req.body);
    res.json(resultado);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// POST /api/motor/lote — Processar lote de produtos
router.post('/lote', async (req, res) => {
  try {
    const { produtos } = req.body;
    if (!Array.isArray(produtos) || produtos.length === 0) {
      return res.status(400).json({ erro: 'Envie um array "produtos"' });
    }

    const resultados = produtos.map(p => motor.processarProduto(p));
    const aprovados = resultados.filter(p => p.decisao === 'APROVADO').length;
    const pendentes = resultados.filter(p => p.decisao === 'PENDENTE').length;
    const bloqueados = resultados.filter(p => p.decisao === 'BLOQUEADO').length;

    res.json({
      ok: true,
      total: resultados.length,
      aprovados,
      pendentes,
      bloqueados,
      produtos: resultados
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ============================================================
// ROUTES — /api/bling
// ============================================================
const blingRouter = express.Router();
const bling = require('../services/bling');

// GET /api/bling/status — Testar conexão Bling
blingRouter.get('/status', async (req, res) => {
  const result = await bling.testarConexao();
  res.json(result);
});

// POST /api/bling/token/renovar
blingRouter.post('/token/renovar', async (req, res) => {
  try {
    await bling.renovarToken();
    res.json({ ok: true, mensagem: 'Token renovado!' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// GET /api/bling/categorias
blingRouter.get('/categorias', async (req, res) => {
  const result = await bling.listarCategorias();
  if (!result.ok) return res.status(500).json({ erro: result.error });
  res.json({ ok: true, categorias: result.data?.data || [] });
});

// GET /api/bling/buscar?codigo=BDJ0430
blingRouter.get('/buscar', async (req, res) => {
  const { codigo } = req.query;
  if (!codigo) return res.status(400).json({ erro: 'Informe o codigo' });
  const result = await bling.buscarPorCodigo(codigo);
  if (!result.ok) return res.status(500).json({ erro: result.error });
  res.json({ ok: true, produtos: result.data?.data || [] });
});

module.exports = { motorRouter: router, blingRouter };
