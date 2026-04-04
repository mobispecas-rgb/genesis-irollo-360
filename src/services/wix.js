// ============================================================
// GENESIS iROLLO v3.0 — WIX STORES API SERVICE
// Sync automático Bling → Wix
// ============================================================
const axios = require('axios');
require('dotenv').config();

const WIX_BASE = 'https://www.wixapis.com/stores/v1';
const WIX_CATALOG = 'https://www.wixapis.com/stores-reader/v1';

function getWixHeaders() {
  return {
    'Authorization': process.env.WIX_API_KEY,
    'wix-site-id': process.env.WIX_SITE_ID,
    'Content-Type': 'application/json'
  };
}

// ------------------------------------------------------------
// LISTAR PRODUTOS WIX
// ------------------------------------------------------------
async function listarProdutosWix({ limit = 50, offset = 0 } = {}) {
  try {
    const resp = await axios.post(
      `${WIX_CATALOG}/products/query`,
      { query: { paging: { limit, offset } } },
      { headers: getWixHeaders() }
    );
    return { ok: true, produtos: resp.data.products || [], total: resp.data.totalResults };
  } catch (err) {
    return { ok: false, erro: err.response?.data?.message || err.message };
  }
}

// ------------------------------------------------------------
// CRIAR PRODUTO NO WIX
// ------------------------------------------------------------
async function criarProdutoWix(produto) {
  try {
    const payload = montarPayloadWix(produto);
    const resp = await axios.post(
      `${WIX_BASE}/products`,
      { product: payload },
      { headers: getWixHeaders() }
    );
    return { ok: true, produto: resp.data.product };
  } catch (err) {
    return { ok: false, erro: err.response?.data?.message || err.message };
  }
}

// ------------------------------------------------------------
// ATUALIZAR PRODUTO WIX
// ------------------------------------------------------------
async function atualizarProdutoWix(wixId, produto) {
  try {
    const payload = montarPayloadWix(produto);
    const resp = await axios.patch(
      `${WIX_BASE}/products/${wixId}`,
      { product: payload },
      { headers: getWixHeaders() }
    );
    return { ok: true, produto: resp.data.product };
  } catch (err) {
    return { ok: false, erro: err.response?.data?.message || err.message };
  }
}

// ------------------------------------------------------------
// SYNC PRODUTO BLING → WIX
// Recebe produto processado pelo Motor iRollo e sobe no Wix
// ------------------------------------------------------------
async function syncBlingParaWix(produto) {
  if (!produto.aprovado && !produto.forcar_wix) {
    return { ok: false, motivo: 'NCT não aprovado — produto não subido no Wix' };
  }

  // Tenta criar; se já existir (409), atualiza
  const resultado = await criarProdutoWix(produto);

  if (!resultado.ok && resultado.erro?.includes('already exists')) {
    // Busca ID Wix pelo SKU e atualiza
    const busca = await buscarPorSKU(produto.sku || produto.codigo);
    if (busca.ok && busca.id) {
      return atualizarProdutoWix(busca.id, produto);
    }
  }

  return resultado;
}

// ------------------------------------------------------------
// BUSCAR PRODUTO WIX POR SKU
// ------------------------------------------------------------
async function buscarPorSKU(sku) {
  try {
    const resp = await axios.post(
      `${WIX_CATALOG}/products/query`,
      { query: { filter: JSON.stringify({ sku }) } },
      { headers: getWixHeaders() }
    );
    const produtos = resp.data.products || [];
    if (produtos.length > 0) {
      return { ok: true, id: produtos[0].id, produto: produtos[0] };
    }
    return { ok: false, motivo: 'Produto não encontrado no Wix' };
  } catch (err) {
    return { ok: false, erro: err.message };
  }
}

// ------------------------------------------------------------
// MONTAR PAYLOAD WIX
// ------------------------------------------------------------
function montarPayloadWix(p) {
  const payload = {
    name: p.nome_completo || p.nome || '',
    description: p.descricao || '',
    sku: p.sku || p.codigo || '',
    visible: true,
    productType: 'physical',

    price: {
      currency: 'BRL',
      price: parseFloat(p.preco || 0)
    },

    seoData: {
      tags: [
        { type: 'title', children: p.nome_completo || p.nome || '' },
        { type: 'meta', props: { name: 'description', content: p.descricao_curta || p.descricao?.substring(0, 160) || '' } }
      ]
    }
  };

  // Imagem
  if (p.imagem_url) {
    payload.media = {
      mainMedia: {
        thumbnail: { url: p.imagem_url },
        mediaType: 'IMAGE'
      }
    };
  }

  // Peso
  if (p.peso_bruto) {
    payload.weight = parseFloat(p.peso_bruto);
  }

  return payload;
}

// ------------------------------------------------------------
// TESTAR CONEXÃO WIX
// ------------------------------------------------------------
async function testarConexaoWix() {
  if (!process.env.WIX_API_KEY || process.env.WIX_API_KEY === 'SUA_WIX_API_KEY_AQUI') {
    return { ok: false, erro: 'WIX_API_KEY não configurada no .env' };
  }
  const result = await listarProdutosWix({ limit: 1 });
  if (result.ok) return { ok: true, mensagem: 'Wix API conectada!', total_produtos: result.total };
  return { ok: false, erro: result.erro };
}

module.exports = {
  listarProdutosWix,
  criarProdutoWix,
  atualizarProdutoWix,
  syncBlingParaWix,
  buscarPorSKU,
  testarConexaoWix
};
