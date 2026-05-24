// ============================================================
// GENESIS iROLLO v3.1 — WIX STORES API SERVICE
// ============================================================
const axios = require('axios');
require('dotenv').config();

const WIX_STORES = 'https://www.wixapis.com/stores/v1';

function getWixHeaders() {
  const key = process.env.WIX_API_KEY || '';
  const siteId = process.env.WIX_SITE_ID || '';
  if (!key || key.includes('AQUI')) throw new Error('WIX_API_KEY não configurada');
  if (!siteId || siteId.includes('AQUI')) throw new Error('WIX_SITE_ID não configurado');
  return { 'Authorization': key.startsWith('Bearer ') ? key : `Bearer ${key}`, 'wix-site-id': siteId, 'Content-Type': 'application/json' };
}

async function wixRequest(method, url, data = null, tentativas = 2) {
  for (let t = 1; t <= tentativas; t++) {
    try {
      const config = { method, url, headers: getWixHeaders(), timeout: 15000 };
      if (data) config.data = data;
      const resp = await axios(config);
      return resp.data;
    } catch (err) {
      const status = err.response?.status;
      if ((status === 429 || status === 503) && t < tentativas) { await new Promise(r => setTimeout(r, 2000 * t)); continue; }
      const mensagem = err.response?.data?.message || err.response?.data?.error || err.message;
      throw new Error(`Wix API erro ${status || '?'}: ${mensagem}`);
    }
  }
}

async function testarConexaoWix() {
  try { const data = await wixRequest('POST', `${WIX_STORES}/products/query`, { query: { paging: { limit: 1 } } }); return { ok: true, mensagem: 'Wix Stores API conectada!', total_produtos: data.totalResults || 0 }; }
  catch (err) { return { ok: false, erro: err.message }; }
}

async function listarProdutosWix({ limit = 50, offset = 0 } = {}) {
  try { const data = await wixRequest('POST', `${WIX_STORES}/products/query`, { query: { paging: { limit, offset } } }); return { ok: true, produtos: data.products || [], total: data.totalResults || 0 }; }
  catch (err) { return { ok: false, erro: err.message }; }
}

async function buscarPorSKU(sku) {
  try { const data = await wixRequest('POST', `${WIX_STORES}/products/query`, { query: { filter: { 'variants.sku': { $eq: sku } } } }); const produtos = data.products || []; if (produtos.length > 0) return { ok: true, id: produtos[0].id, produto: produtos[0] }; return { ok: false, motivo: 'Não encontrado no Wix' }; }
  catch (err) { return { ok: false, erro: err.message }; }
}

function montarPayloadWix(p) {
  const nome = p.nome_completo || p.nome || '';
  const payload = { name: nome, description: p.descricao_tecnica || p.descricao || '', sku: p.sku || p.codigo || '', visible: true, productType: 'physical', priceData: { currency: 'BRL', price: parseFloat(p.preco || 0) }, seoData: { tags: [{ type: 'title', children: nome.substring(0, 70) }, { type: 'meta', props: { name: 'description', content: (p.descricao_curta || '').substring(0, 160) } }] } };
  if (p.galeria_imagens && Array.isArray(p.galeria_imagens)) payload.media = { items: p.galeria_imagens.filter(img => img && img.startsWith('http')).slice(0, 6).map(url => ({ image: { url } })) };
  else if (p.imagem_url) payload.media = { items: [{ image: { url: p.imagem_url } }] };
  if (p.peso_bruto) payload.weight = parseFloat(p.peso_bruto);
  return payload;
}

async function criarProdutoWix(produto) {
  try { const data = await wixRequest('POST', `${WIX_STORES}/products`, { product: montarPayloadWix(produto) }); return { ok: true, produto: data.product, id: data.product?.id }; }
  catch (err) { return { ok: false, erro: err.message }; }
}

async function atualizarProdutoWix(wixId, produto) {
  try { const data = await wixRequest('PATCH', `${WIX_STORES}/products/${wixId}`, { product: montarPayloadWix(produto) }); return { ok: true, produto: data.product }; }
  catch (err) { return { ok: false, erro: err.message }; }
}

async function syncBlingParaWix(produto) {
  if (!produto.aprovado && !produto.forcar_wix) return { ok: false, motivo: `NCT ${produto.nct || 0} abaixo do mínimo. Use forcar_wix:true para forçar.` };
  const criacao = await criarProdutoWix(produto);
  if (!criacao.ok) {
    if (criacao.erro?.includes('already') || criacao.erro?.includes('exists') || criacao.erro?.includes('409')) {
      const busca = await buscarPorSKU(produto.sku || produto.codigo);
      if (busca.ok && busca.id) { const att = await atualizarProdutoWix(busca.id, produto); return { ...att, operacao: 'atualizado', wix_id: busca.id }; }
    }
    return criacao;
  }
  return { ...criacao, operacao: 'criado' };
}

async function syncLoteParaWix(produtos, delayMs = 800) {
  const resultados = [];
  for (let i = 0; i < produtos.length; i++) {
    const r = await syncBlingParaWix(produtos[i]);
    resultados.push({ ...r, produto: produtos[i].sku || produtos[i].nome });
    if (i < produtos.length - 1) await new Promise(r => setTimeout(r, delayMs));
  }
  const ok = resultados.filter(r => r.ok).length;
  return { ok: resultados.filter(r => !r.ok).length === 0, total: produtos.length, sincronizados: ok, falhas: resultados.length - ok, resultados };
}

module.exports = { testarConexaoWix, listarProdutosWix, buscarPorSKU, criarProdutoWix, atualizarProdutoWix, syncBlingParaWix, syncLoteParaWix };
