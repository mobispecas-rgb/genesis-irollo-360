// ============================================================
// GENESIS iROLLO v3.1 — ROTAS DE EMPRESA / CNPJ PROFILER
// POST /api/empresa/consultar-cnpj
// GET  /api/empresa/categorias
// GET  /api/empresa/ncm/:codigo
// POST /api/empresa/sugerir-categoria
// ============================================================
const express = require('express');
const router  = express.Router();
const { consultarCNPJ, criarPerfilEmpresa } = require('../services/cnpj-profiler');
const { CATEGORIAS, NCM_AUTOPECAS, sugerirCategoria, REGRAS_INDEXACAO, VEICULOS_POPULARES } = require('../database/autopecas-master');
const { validarCNPJ, validarNCM } = require('../utils/validacao');

// POST /api/empresa/consultar-cnpj
router.post('/consultar-cnpj', async (req, res) => {
  const { cnpj } = req.body;
  if (!cnpj) return res.status(400).json({ ok: false, erro: 'CNPJ obrigatório' });
  const resultado = await criarPerfilEmpresa(cnpj);
  res.json(resultado);
});

// GET /api/empresa/categorias
router.get('/categorias', (req, res) => {
  res.json({ ok: true, total: Object.keys(CATEGORIAS).length, categorias: CATEGORIAS });
});

// GET /api/empresa/ncm/:codigo
router.get('/ncm/:codigo', (req, res) => {
  const { codigo } = req.params;
  const validacao  = validarNCM(codigo);
  const dadosNCM   = NCM_AUTOPECAS[validacao.ncm_limpo] || null;
  res.json({ ok: true, validacao, dados_fiscais: dadosNCM, relevante_autopeca: !!dadosNCM });
});

// GET /api/empresa/ncm-lista
router.get('/ncm-lista', (req, res) => {
  res.json({ ok: true, total: Object.keys(NCM_AUTOPECAS).length, ncms: NCM_AUTOPECAS });
});

// POST /api/empresa/sugerir-categoria
router.post('/sugerir-categoria', (req, res) => {
  const { nome } = req.body;
  if (!nome) return res.status(400).json({ ok: false, erro: 'Nome obrigatório' });
  const sugestao = sugerirCategoria(nome);
  res.json({ ok: true, ...sugestao });
});

// GET /api/empresa/regras-indexacao
router.get('/regras-indexacao', (req, res) => {
  res.json({ ok: true, regras: REGRAS_INDEXACAO });
});

// GET /api/empresa/veiculos
router.get('/veiculos', (req, res) => {
  const { marca } = req.query;
  if (marca) {
    const marcaUp = marca.toUpperCase();
    return res.json({ ok: true, marca: marcaUp, modelos: VEICULOS_POPULARES[marcaUp] || [] });
  }
  res.json({ ok: true, veiculos: VEICULOS_POPULARES });
});

// POST /api/empresa/validar-produto
router.post('/validar-produto', (req, res) => {
  const produto = req.body;
  const erros = [];
  const avisos = [];

  if (produto.ncm) {
    const ncmVal = validarNCM(produto.ncm);
    if (!ncmVal.valido) erros.push(`NCM: ${ncmVal.motivo}`);
    else if (!ncmVal.relevante_autopeca) avisos.push(`NCM ${produto.ncm} incomum para autopeças`);
  } else {
    erros.push('NCM obrigatório');
  }

  if (!produto.oem || produto.oem.length < 4) erros.push('OEM deve ter pelo menos 4 caracteres');
  if (!produto.nome || produto.nome.trim().split(/\s+/).length < 3) erros.push('Nome deve ter pelo menos 3 palavras (Full-Match)');
  if (!produto.aplicacao || produto.aplicacao.length < 8) avisos.push('Aplicação veicular curta — afeta NCT (AV -10%)');

  const categoria = sugerirCategoria(produto.nome || '');

  res.json({
    ok: erros.length === 0,
    erros, avisos,
    categoria_sugerida: categoria.categoria,
    resumo: erros.length === 0 ? `Produto válido${avisos.length > 0 ? ` com ${avisos.length} aviso(s)` : ''}` : `${erros.length} erro(s) bloqueante(s)`
  });
});

module.exports = router;
