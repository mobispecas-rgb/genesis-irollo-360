// ============================================================
// ROUTES – /api/produtos
// Modo DUAL: LOCAL (sem Bling) + BLING (quando CLIENT_SECRET ok)
// Banco de dados: SQLite próprio (better-sqlite3)
// ============================================================
const express = require('express');
const router = express.Router();
const bling = require('../services/bling');
const gemini = require('../services/gemini');
const motor = require('../services/motor');
const db = require('../database');

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
        const produtos = (result.data?.data || []).map(p => ({
          ...p,
          nct_calc: motor.calcularNCT({ oem: p.codigo, ncm: p.tributacao?.ncm, nome: p.nome, sku: p.codigo }),
          rast_hash: motor.gerarRastHash(p.codigo, p.codigo)
        }));
        return res.json({ ok: true, total: result.data?.meta?.total || produtos.length, pagina: parseInt(pagina), produtos, fonte: 'bling' });
      }
    }
    const offset = (parseInt(pagina) - 1) * parseInt(limite);
    const lista = db.produtos.listar.all({ nome: nome || null, limite: parseInt(limite), offset });
    const { total } = db.produtos.contar.get({ nome: nome || null });
    res.json({ ok: true, total, pagina: parseInt(pagina), produtos: lista, fonte: 'local' });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.get('/local/lista', (req, res) => {
  try {
    const lista = db.produtos.listar.all({ nome: null, limite: 9999, offset: 0 });
    const { total } = db.produtos.contar.get({ nome: null });
    res.json({ ok: true, total, produtos: lista });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const local = db.produtos.getById.get(req.params.id, req.params.id);
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
    const idLocal = db.nextLocalId();
    const cadastrado_em = new Date().toISOString();
    db.produtos.insert.run({
      id: idLocal, nome: processado.nome, oem: processado.oem || null,
      sku: processado.sku || null, ncm: processado.ncm || null,
      nct: processado.nct, rast_hash: processado.rast_hash,
      situacao: 'Ativo', id_bling: null,
      aplicacao: processado.aplicacao || null,
      dados_json: JSON.stringify(processado),
      cadastrado_em, fonte: 'local'
    });
    let idBling = null, blingOk = false, blingMsg = 'Bling nao configurado';
    if (blingConfigurado()) {
      try {
        const result = await bling.criarProduto(processado);
        if (result.ok) {
          idBling = result.data?.data?.id; blingOk = true; blingMsg = 'Enviado ao Bling!';
          if (idBling) {
            db.produtos.update.run({
              nome: processado.nome, oem: processado.oem || null, sku: processado.sku || null,
              ncm: processado.ncm || null, nct: processado.nct, rast_hash: processado.rast_hash,
              situacao: 'Ativo', id_bling: idBling, aplicacao: processado.aplicacao || null,
              dados_json: JSON.stringify(processado), atualizado_em: new Date().toISOString(),
              busca_id: idLocal
            });
          }
        } else { blingMsg = 'Bling: ' + (result.error || 'erro'); }
      } catch(e) { blingMsg = 'Bling offline: ' + e.message; }
    }
    res.status(201).json({ ok: true, mensagem: blingOk ? 'Cadastrado no Bling!' : 'Cadastrado localmente', id_local: idLocal, id_bling: idBling, bling_ok: blingOk, nct: processado.nct, decisao: processado.decisao, rast_hash: processado.rast_hash });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const processado = motor.processarProduto(req.body);
    const existente = db.produtos.getById.get(req.params.id, req.params.id);
    db.produtos.update.run({
      nome: processado.nome, oem: processado.oem || null, sku: processado.sku || null,
      ncm: processado.ncm || null, nct: processado.nct, rast_hash: processado.rast_hash,
      situacao: existente?.situacao || 'Ativo', id_bling: existente?.id_bling || null,
      aplicacao: processado.aplicacao || null, dados_json: JSON.stringify(processado),
      atualizado_em: new Date().toISOString(), busca_id: req.params.id
    });
    if (blingConfigurado()) await bling.atualizarProduto(req.params.id, processado);
    res.json({ ok: true, mensagem: 'Produto atualizado!', nct: processado.nct, rast_hash: processado.rast_hash });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    db.produtos.delete.run(req.params.id, req.params.id);
    if (blingConfigurado()) await bling.deletarProduto(req.params.id);
    res.json({ ok: true, mensagem: 'Produto removido.' });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.post('/:id/enriquecer', async (req, res) => {
  try {
    let p = db.produtos.getById.get(req.params.id, req.params.id);
    if (!p && blingConfigurado()) {
      const r = await bling.buscarProduto(req.params.id);
      if (r.ok) p = r.data?.data;
    }
    if (!p) return res.status(404).json({ erro: 'Produto nao encontrado' });
    const enrich = await gemini.enriquecerProduto({
      oem: p.codigo || p.oem, nome: p.nome,
      ncm: p.tributacao?.ncm || p.ncm, sku: p.codigo || p.sku
    });
    const dados = {
      ...p, oem: p.codigo || p.oem,
      nome: enrich.dados?.nome_enriquecido || p.nome,
      aplicacao: enrich.dados?.aplicacao_veicular,
      ncm: enrich.dados?.ncm_sugerido || p.ncm
    };
    const nctCalc = motor.calcularNCT(dados);
    res.json({ ok: true, enriquecimento: enrich.dados, nct: nctCalc.nct, decisao: nctCalc.decisao, rast_hash: nctCalc.rast_hash });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

module.exports = router;
