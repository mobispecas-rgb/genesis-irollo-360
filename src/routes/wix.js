// ============================================================
// ROUTES — /api/wix
// ============================================================
const express = require('express');
const router = express.Router();
const wix = require('../services/wix');
const bling = require('../services/bling');
const motor = require('../services/motor');

router.get('/status', async (req, res) => {
  const result = await wix.testarConexaoWix();
  res.json(result);
});

router.get('/produtos', async (req, res) => {
  const { limit = 50, offset = 0 } = req.query;
  const result = await wix.listarProdutosWix({ limit: parseInt(limit), offset: parseInt(offset) });
  if (!result.ok) return res.status(500).json({ erro: result.erro });
  res.json({ ok: true, total: result.total, produtos: result.produtos });
});

router.post('/sync/:blingId', async (req, res) => {
  try {
    const blingResult = await bling.buscarProduto(req.params.blingId);
    if (!blingResult.ok) return res.status(404).json({ erro: 'Produto não encontrado no Bling' });
    const p = blingResult.data?.data;
    const processado = motor.processarProduto({ oem: p.codigo, nome: p.nome, ncm: p.tributacao?.ncm, sku: p.codigo, preco: p.preco, descricao: p.descricaoComplementar });
    const wixResult = await wix.syncBlingParaWix(processado);
    if (!wixResult.ok) return res.status(500).json({ erro: wixResult.erro || wixResult.motivo });
    res.json({ ok: true, mensagem: 'Produto sincronizado Bling → Wix!', bling_id: req.params.blingId, wix_id: wixResult.produto?.id, nct: processado.nct, rast_hash: processado.rast_hash });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.post('/sync-lote', async (req, res) => {
  try {
    const { bling_ids } = req.body;
    if (!Array.isArray(bling_ids) || bling_ids.length === 0) return res.status(400).json({ erro: 'Envie array "bling_ids"' });
    const resultados = [];
    let ok_count = 0, erro_count = 0;
    for (const blingId of bling_ids) {
      const blingResult = await bling.buscarProduto(blingId);
      if (!blingResult.ok) { resultados.push({ bling_id: blingId, status: 'erro', motivo: 'Não encontrado no Bling' }); erro_count++; continue; }
      const p = blingResult.data?.data;
      const processado = motor.processarProduto({ oem: p.codigo, nome: p.nome, ncm: p.tributacao?.ncm, sku: p.codigo, preco: p.preco });
      const wixResult = await wix.syncBlingParaWix(processado);
      if (wixResult.ok) { ok_count++; resultados.push({ bling_id: blingId, status: 'sincronizado', wix_id: wixResult.produto?.id }); }
      else { erro_count++; resultados.push({ bling_id: blingId, status: 'erro', motivo: wixResult.erro }); }
      await new Promise(r => setTimeout(r, 300));
    }
    res.json({ ok: true, sincronizados: ok_count, erros: erro_count, resultados });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

module.exports = router;
