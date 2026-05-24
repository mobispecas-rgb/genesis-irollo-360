// ============================================================
// GENESIS iROLLO v3.0 — BLING API v3 SERVICE
// OAuth2 com Refresh Token automático
// ============================================================
const axios = require('axios');
require('dotenv').config();

const BLING_BASE = process.env.BLING_BASE_URL || 'https://www.bling.com.br/Api/v3';

let tokenCache = {
  access_token: process.env.BLING_ACCESS_TOKEN || '',
  expires_at: Date.now() + (6 * 60 * 60 * 1000)
};

async function renovarToken() {
  console.log('[BLING] Renovando Access Token...');
  try {
    const credentials = Buffer.from(`${process.env.BLING_CLIENT_ID}:${process.env.BLING_CLIENT_SECRET}`).toString('base64');
    const resp = await axios.post('https://www.bling.com.br/Api/v3/oauth/token', new URLSearchParams({ grant_type: 'refresh_token', refresh_token: process.env.BLING_REFRESH_TOKEN }), { headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' } });
    tokenCache.access_token = resp.data.access_token;
    tokenCache.expires_at = Date.now() + (resp.data.expires_in * 1000);
    if (resp.data.refresh_token) process.env.BLING_REFRESH_TOKEN = resp.data.refresh_token;
    console.log('[BLING] Token renovado!');
    return tokenCache.access_token;
  } catch (err) {
    console.error('[BLING] Erro ao renovar:', err.response?.data || err.message);
    return tokenCache.access_token;
  }
}

async function getToken() {
  if (Date.now() > tokenCache.expires_at - 300000) await renovarToken();
  return tokenCache.access_token;
}

async function blingRequest(method, endpoint, data = null, params = {}) {
  const token = await getToken();
  const config = { method, url: `${BLING_BASE}${endpoint}`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/json' }, params };
  if (data) config.data = data;
  try {
    const resp = await axios(config);
    return { ok: true, data: resp.data, status: resp.status };
  } catch (err) {
    if (err.response?.status === 401) {
      await renovarToken();
      config.headers['Authorization'] = `Bearer ${tokenCache.access_token}`;
      try { const resp2 = await axios(config); return { ok: true, data: resp2.data, status: resp2.status }; }
      catch (err2) { return { ok: false, error: err2.response?.data || err2.message, status: err2.response?.status }; }
    }
    return { ok: false, error: err.response?.data || err.message, status: err.response?.status };
  }
}

async function listarProdutos({ pagina = 1, limite = 50, nome = '', situacao = '' } = {}) {
  const params = { pagina, limite };
  if (nome) params.nome = nome;
  if (situacao) params.situacao = situacao;
  return blingRequest('GET', '/produtos', null, params);
}

async function buscarProduto(id) { return blingRequest('GET', `/produtos/${id}`); }

async function criarProduto(produto) { return blingRequest('POST', '/produtos', montarPayloadProduto(produto)); }

async function atualizarProduto(id, produto) { return blingRequest('PUT', `/produtos/${id}`, montarPayloadProduto(produto)); }

async function deletarProduto(id) { return blingRequest('DELETE', `/produtos/${id}`); }

async function buscarPorCodigo(codigo) { return blingRequest('GET', '/produtos', null, { codigo, limite: 5 }); }

function montarPayloadProduto(p) {
  const payload = { nome: p.nome_completo || p.nome || '', codigo: p.sku || p.codigo || '', preco: parseFloat(p.preco || 0), situacao: p.situacao || 'A', tipo: 'P', unidade: 'UN', descricaoCurta: p.descricao_curta || '', descricaoComplementar: p.descricao || '', tributacao: { ncm: (p.ncm || '').replace(/\D/g, ''), origem: parseInt(p.origem || 0) } };
  if (p.marca) payload.marca = { nome: p.marca };
  if (p.categoria_id) payload.categoria = { id: parseInt(p.categoria_id) };
  Object.keys(payload).forEach(k => { if (payload[k] === '' || payload[k] === null || payload[k] === undefined) delete payload[k]; });
  return payload;
}

async function listarCategorias() { return blingRequest('GET', '/categorias/produtos'); }
async function criarCategoria(nome, idPai = null) { const p = { descricao: nome }; if (idPai) p.categoriaPai = { id: idPai }; return blingRequest('POST', '/categorias/produtos', p); }
async function buscarContato(nome) { return blingRequest('GET', '/contatos', null, { nome, limite: 5 }); }
async function testarConexao() { const r = await blingRequest('GET', '/produtos', null, { limite: 1 }); if (r.ok) return { ok: true, mensagem: 'Bling API v3 OK!', token_expira_em: new Date(tokenCache.expires_at).toISOString() }; return { ok: false, erro: r.error }; }

module.exports = { listarProdutos, buscarProduto, criarProduto, atualizarProduto, deletarProduto, buscarPorCodigo, listarCategorias, criarCategoria, buscarContato, testarConexao, renovarToken, getToken };
