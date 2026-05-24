// ============================================================
// ROUTES — /api/produtos
// Modo DUAL: LOCAL (sem Bling) + BLING (quando CLIENT_SECRET ok)
// ============================================================
const express = require('express');
const router = express.Router();
const bling = require('../services/bling');
const gemini = require('../services/gemini');
const motor = require('../services/motor');

let catalogoLocal = [];
let idLocalCounter = 1000;

function blingConfigurado() {
  const s = process.env.BLING_CLIENT_SECRET || '';
  return s.length > 10 && !s.includes('AQUI');
}

router.get('/', async (req, res) => {
  try {
    const { pagina = 1, limite = 50, nome, situacao } = req.query;
    if (blingConfigurado()) {
      const result = await bling.listarProdutos({ pagina: parseInt(pagina), limite: parseInt(limite), nome, situacao });
      if (result.ok) {
        const produtos = (result.data?.data || []).map(p => ({ ...p, nct_calc: motor.calcularNCT({ oem: p.codigo, ncm: p.tributacao?.ncm, nome: p.nome, sku: p.codigo }), rast_hash: motor.gerarRastHash(p.codigo, p.codigo) }));
        return res.json({ ok: true, total: result.data?.meta?.total || produtos.length, pagina: parseInt(pagina), produtos, fonte: 'bling' });
      }
    }
    let lista = [...catalogoLocal];
    if (nome) lista = lista.filter(p => p.nome?.toLowerCase().includes(nome.toLowerCase()));
    const inicio = (parseInt(pagina) - 1) * parseInt(limite);
    const paginado = lista.slice(inicio, inicio + parseInt(limite));
    res.json({ ok: true, total: lista.length, pagina: parseInt(pagina), produtos: paginado, fonte: 'local' });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.get('/local/lista', (req, res) => {
  res.json({ ok: true, total: catalogoLocal.length, produtos: catalogoLocal });
});

router.get('/:id', async (req, res) => {
  try {
    const local = catalogoLocal.find(p => String(p.id) === String(req.params.id));
    if (local) return res.json({ ok: true, produto: local, fonte: 'local' });
    if (!blingConfigurado()) return res.status(404).json({ erro: 'Produto não encontrado' });
    const result = await bling.buscarProduto(req.params.id);
    if (!result.ok) return res.status(404).json({ erro: result.error });
    const p = result.data?.data;
    const nctCalc = motor.calcularNCT({ oem: p.codigo, ncm: p.tributacao?.ncm, nome: p.nome, sku: p.codigo });
    res.json({ ok: true, produto: { ...p, nct: nctCalc.nct, decisao: nctCalc.decisao, rast_hash: motor.gerarRastHash(p.codigo, p.codigo) }, fonte: 'bling' });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const dados = req.body;
    const processado = motor.processarProduto(dados);
    const nctMinimo = parseFloat(process.env.NCT_MINIMO || 0.90);
    if (processado.nct < nctMinimo && !dados.forcar_cadastro) {
      return res.status(422).json({ erro: 'NCT insuficiente', nct: processado.nct, decisao: processado.decisao, minimo_exigido: nctMinimo, produto_processado: processado });
    }
    const idLocal = 'LOCAL-' + (idLocalCounter++);
    const produtoLocal = { ...processado, id: idLocal, situacao: 'Ativo', cadastrado_em: new Date().toISOString(), fonte: 'local' };
    catalogoLocal.push(produtoLocal);
    let idBling = null, blingOk = false, blingMsg = 'Bling não configurado — salvo localmente';
    if (blingConfigurado()) {
      try {
        const result = await bling.criarProduto(processado);
        if (result.ok) { idBling = result.data?.data?.id; blingOk = true; blingMsg = 'Enviado ao Bling!'; produtoLocal.id_bling = idBling; }
        else { blingMsg = 'Bling: ' + (result.error || 'erro'); }
      } catch(e) { blingMsg = 'Bling offline: ' + e.message; }
    }
    res.status(201).json({ ok: true, mensagem: blingOk ? 'Cadastrado no Bling!' : 'Cadastrado localmente', id_local: idLocal, id_bling: idBling, bling_ok: blingOk, nct: processado.nct, decisao: processado.decisao, rast_hash: processado.rast_hash, produto: produtoLocal });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const processado = motor.processarProduto(req.body);
    const idx = catalogoLocal.findIndex(p => String(p.id) === String(req.params.id) || String(p.id_bling) === String(req.params.id));
    if (idx >= 0) catalogoLocal[idx] = { ...catalogoLocal[idx], ...processado, atualizado_em: new Date().toISOString() };
    if (blingConfigurado()) await bling.atualizarProduto(req.params.id, processado);
    res.json({ ok: true, mensagem: 'Produto atualizado!', nct: processado.nct, rast_hash: processado.rast_hash });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    catalogoLocal = catalogoLocal.filter(p => String(p.id) !== String(req.params.id));
    if (blingConfigurado()) await bling.deletarProduto(req.params.id);
    res.json({ ok: true, mensagem: 'Produto removido.' });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.post('/:id/enriquecer', async (req, res) => {
  try {
    let p = catalogoLocal.find(prod => String(prod.id) === String(req.params.id) || String(prod.id_bling) === String(req.params.id));
    if (!p && blingConfigurado()) { const r = await bling.buscarProduto(req.params.id); if (r.ok) p = r.data?.data; }
    if (!p) return res.status(404).json({ erro: 'Produto não encontrado' });
    const enrich = await gemini.enriquecerProduto({ oem: p.codigo || p.oem, nome: p.nome, ncm: p.tributacao?.ncm || p.ncm, sku: p.codigo || p.sku });
    const dados = { ...p, oem: p.codigo || p.oem, nome: enrich.dados?.nome_enriquecido || p.nome, aplicacao: enrich.dados?.aplicacao_veicular, ncm: enrich.dados?.ncm_sugerido || p.ncm };
    const nctCalc = motor.calcularNCT(dados);
    res.json({ ok: true, enriquecimento: enrich.dados, nct: nctCalc.nct, decisao: nctCalc.decisao, rast_hash: nctCalc.rast_hash });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

module.exports = router;
