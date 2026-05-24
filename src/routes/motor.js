// ============================================================
// ROUTES — /api/motor (NCT, RAST-HASH, Enriquecimento)
// ============================================================
const express = require('express');
const router = express.Router();
const motor = require('../services/motor');
const gemini = require('../services/gemini');

// POST /api/motor/nct
router.post('/nct', (req, res) => {
  try {
    const resultado = motor.calcularNCT(req.body);
    res.json({ ok: true, ...resultado });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// POST /api/motor/processar
router.post('/processar', (req, res) => {
  try {
    const processado = motor.processarProduto(req.body);
    res.json({ ok: true, produto: processado });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// POST /api/motor/hash
router.post('/hash', (req, res) => {
  const { sku, oem, empresa } = req.body;
  if (!sku && !oem) return res.status(400).json({ erro: 'SKU ou OEM obrigatório' });
  const hash = motor.gerarRastHash(sku, oem, empresa || 'MOBIS');
  res.json({ ok: true, rast_hash: hash });
});

// POST /api/motor/enriquecer
router.post('/enriquecer', async (req, res) => {
  try {
    const enrich = await gemini.enriquecerProduto(req.body);
    if (!enrich.ok) return res.status(500).json({ erro: enrich.erro });
    const dadosMerged = { ...req.body, ...enrich.dados, aplicacao: enrich.dados.aplicacao_veicular };
    const nctCalc = motor.calcularNCT(dadosMerged);
    res.json({ ok: true, enriquecimento: enrich.dados, nct: nctCalc.nct, decisao: nctCalc.decisao, rast_hash: nctCalc.rast_hash, modelo_ia: enrich.modelo_usado });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// POST /api/motor/titulo
router.post('/titulo', async (req, res) => {
  try {
    const resultado = await gemini.gerarTituloSEO(req.body);
    res.json(resultado);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// POST /api/motor/lote
router.post('/lote', async (req, res) => {
  try {
    const { produtos } = req.body;
    if (!Array.isArray(produtos) || produtos.length === 0) return res.status(400).json({ erro: 'Envie um array "produtos"' });
    const resultados = produtos.map(p => motor.processarProduto(p));
    const aprovados = resultados.filter(p => p.decisao === 'APROVADO').length;
    const pendentes = resultados.filter(p => p.decisao === 'PENDENTE').length;
    const bloqueados = resultados.filter(p => p.decisao === 'BLOQUEADO').length;
    res.json({ ok: true, total: resultados.length, aprovados, pendentes, bloqueados, produtos: resultados });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// ============================================================
// ROUTES — /api/bling
// ============================================================
const blingRouter = express.Router();
const bling = require('../services/bling');

blingRouter.get('/status', async (req, res) => {
  const result = await bling.testarConexao();
  res.json(result);
});

blingRouter.post('/token/renovar', async (req, res) => {
  try {
    await bling.renovarToken();
    res.json({ ok: true, mensagem: 'Token renovado!' });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

blingRouter.get('/categorias', async (req, res) => {
  const result = await bling.listarCategorias();
  if (!result.ok) return res.status(500).json({ erro: result.error });
  res.json({ ok: true, categorias: result.data?.data || [] });
});

blingRouter.get('/buscar', async (req, res) => {
  const { codigo } = req.query;
  if (!codigo) return res.status(400).json({ erro: 'Informe o codigo' });
  const result = await bling.buscarPorCodigo(codigo);
  if (!result.ok) return res.status(500).json({ erro: result.error });
  res.json({ ok: true, produtos: result.data?.data || [] });
});

module.exports = { motorRouter: router, blingRouter };
