// ============================================================
// ROUTES — /api/motor (NCT, RAST-HASH, Enriquecimento)
// Genesis iRollo 360 v4.0
// ============================================================
const express = require('express');
const router  = express.Router();
const motor   = require('../services/motor');
const gemini  = require('../services/gemini');
const bling   = require('../services/bling');

// ─── POST /api/motor/nct — Calcular NCT de um produto ───────
router.post('/nct', (req, res) => {
    try {
          const resultado = motor.calcularNCT(req.body);
          res.json({ ok: true, ...resultado });
    } catch (err) {
          res.status(500).json({ erro: err.message });
    }
});

// ─── POST /api/motor/processar — Processar produto completo ──
router.post('/processar', (req, res) => {
    try {
          const processado = motor.processarProduto(req.body);
          res.json({ ok: true, produto: processado });
    } catch (err) {
          res.status(500).json({ erro: err.message });
    }
});

// ─── POST /api/motor/hash — Gerar RAST-HASH ─────────────────
router.post('/hash', (req, res) => {
    const { sku, oem, empresa } = req.body;
    if (!sku && !oem) return res.status(400).json({ erro: 'SKU ou OEM obrigatório' });
    const hash = motor.gerarRastHash(sku, oem, empresa || 'MOBIS');
    res.json({ ok: true, rast_hash: hash, input: `md5(${sku}+${oem}+${empresa || 'MOBIS'})[:16]` });
});

// ─── POST /api/motor/enriquecer — Enriquecer via Gemini ─────
router.post('/enriquecer', async (req, res) => {
    try {
          const enrich = await gemini.enriquecerProduto(req.body);
          if (!enrich.ok) {
                  return res.status(500).json({ erro: enrich.erro, parcial: enrich.dados_parciais });
          }
          const dadosMerged = { ...req.body, ...enrich.dados, aplicacao: enrich.dados.aplicacao_veicular };
          const nctCalc = motor.calcularNCT(dadosMerged);
          res.json({
                  ok           : true,
                  enriquecimento: enrich.dados,
                  nct          : nctCalc.nct,
                  decisao      : nctCalc.decisao,
                  rast_hash    : nctCalc.rast_hash,
                  modelo_ia    : enrich.modelo_usado
          });
    } catch (err) {
          res.status(500).json({ erro: err.message });
    }
});

// ─── POST /api/motor/titulo — Gerar título Full-Match SEO ────
router.post('/titulo', async (req, res) => {
    try {
          const resultado = await gemini.gerarTituloSEO(req.body);
          res.json(resultado);
    } catch (err) {
          res.status(500).json({ erro: err.message });
    }
});

// ─── POST /api/motor/lote — Processar lote de produtos ───────
router.post('/lote', async (req, res) => {
    try {
          const { produtos } = req.body;
          if (!Array.isArray(produtos) || produtos.length === 0) {
                  return res.status(400).json({ erro: 'Envie um array "produtos"' });
          }
          const resultados  = produtos.map(p => motor.processarProduto(p));
          const aprovados   = resultados.filter(p => p.decisao === 'APROVADO').length;
          const pendentes   = resultados.filter(p => p.decisao === 'PENDENTE').length;
          const bloqueados  = resultados.filter(p => p.decisao === 'BLOQUEADO').length;
          res.json({ ok: true, total: resultados.length, aprovados, pendentes, bloqueados, produtos: resultados });
    } catch (err) {
          res.status(500).json({ erro: err.message });
    }
});

// ============================================================
// ROUTES — /api/bling
// ============================================================
const blingRouter = express.Router();

// GET /api/bling/status — Testar conexão Bling (real, não fixo)
blingRouter.get('/status', async (req, res) => {
    try {
          const result = await bling.testarConexao();
          res.json(result);
    } catch (err) {
          res.status(500).json({ ok: false, erro: err.message });
    }
});

// POST /api/bling/token/renovar
blingRouter.post('/token/renovar', async (req, res) => {
    try {
          await bling.renovarToken();
          res.json({ ok: true, mensagem: 'Token renovado com sucesso!' });
    } catch (err) {
          res.status(500).json({ ok: false, erro: err.message });
    }
});

// GET /api/bling/categorias
blingRouter.get('/categorias', async (req, res) => {
    try {
          const result = await bling.listarCategorias();
          if (!result.ok) return res.status(500).json({ ok: false, erro: bling.formatarErro(result.error) });
          res.json({ ok: true, categorias: result.data?.data || [] });
    } catch (err) {
          res.status(500).json({ ok: false, erro: err.message });
    }
});

// GET /api/bling/buscar?codigo=BDJ0430
blingRouter.get('/buscar', async (req, res) => {
    try {
          const { codigo } = req.query;
          if (!codigo) return res.status(400).json({ erro: 'Informe o codigo' });
          const result = await bling.buscarPorCodigo(codigo);
          if (!result.ok) return res.status(500).json({ ok: false, erro: bling.formatarErro(result.error) });
          res.json({ ok: true, produtos: result.data?.data || [] });
    } catch (err) {
          res.status(500).json({ ok: false, erro: err.message });
    }
});

// GET /api/bling/produtos — Listar produtos do Bling
blingRouter.get('/produtos', async (req, res) => {
    try {
          const { pagina = 1, limite = 50, nome, situacao } = req.query;
          const result = await bling.listarProdutos({ pagina: parseInt(pagina), limite: parseInt(limite), nome, situacao });
          if (!result.ok) return res.status(500).json({ ok: false, erro: bling.formatarErro(result.error) });
          res.json({ ok: true, total: result.data?.meta?.total || 0, produtos: result.data?.data || [] });
    } catch (err) {
          res.status(500).json({ ok: false, erro: err.message });
    }
});

module.exports = { motorRouter: router, blingRouter };
