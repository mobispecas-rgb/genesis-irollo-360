// ============================================================
// GENESIS iROLLO v3.0 — BLING API v3 SERVICE
// OAuth2 com Refresh Token automático
// ============================================================
const axios = require('axios');
require('dotenv').config();

const BLING_BASE = process.env.BLING_BASE_URL || 'https://www.bling.com.br/Api/v3';

// Token em memória (renovado automaticamente)
let tokenCache = {
  access_token: process.env.BLING_ACCESS_TOKEN || '',
  expires_at: Date.now() + (6 * 60 * 60 * 1000) // 6 horas
};

// ------------------------------------------------------------
// RENOVAR ACCESS TOKEN via Refresh Token
// ------------------------------------------------------------
async function renovarToken() {
  console.log('[BLING] Renovando Access Token...');
  try {
    const credentials = Buffer.from(
      `${process.env.BLING_CLIENT_ID}:${process.env.BLING_CLIENT_SECRET}`
    ).toString('base64');

    const resp = await axios.post(
      'https://www.bling.com.br/Api/v3/oauth/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: process.env.BLING_REFRESH_TOKEN
      }),
      {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    tokenCache.access_token = resp.data.access_token;
    tokenCache.expires_at = Date.now() + (resp.data.expires_in * 1000);

    // Atualiza refresh token se vier novo
    if (resp.data.refresh_token) {
      process.env.BLING_REFRESH_TOKEN = resp.data.refresh_token;
    }

    console.log('[BLING] Token renovado com sucesso!');
    return tokenCache.access_token;

  } catch (err) {
    console.error('[BLING] Erro ao renovar token:', err.response?.data || err.message);
    // Retorna token atual mesmo que falhe
    return tokenCache.access_token;
  }
}

// ------------------------------------------------------------
// OBTER TOKEN (renova se expirado)
// ------------------------------------------------------------
async function getToken() {
  // Renova se faltar menos de 5 minutos
  if (Date.now() > tokenCache.expires_at - 300000) {
    await renovarToken();
  }
  return tokenCache.access_token;
}

// ------------------------------------------------------------
// CLIENTE HTTP BLING
// ------------------------------------------------------------
async function blingRequest(method, endpoint, data = null, params = {}) {
  const token = await getToken();

  const config = {
    method,
    url: `${BLING_BASE}${endpoint}`,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    params
  };

  if (data) config.data = data;

  try {
    const resp = await axios(config);
    return { ok: true, data: resp.data, status: resp.status };
  } catch (err) {
    // Token expirado — tenta renovar e repetir
    if (err.response?.status === 401) {
      console.log('[BLING] Token expirado, renovando...');
      await renovarToken();
      config.headers['Authorization'] = `Bearer ${tokenCache.access_token}`;
      try {
        const resp2 = await axios(config);
        return { ok: true, data: resp2.data, status: resp2.status };
      } catch (err2) {
        return { ok: false, error: err2.response?.data || err2.message, status: err2.response?.status };
      }
    }
    return { ok: false, error: err.response?.data || err.message, status: err.response?.status };
  }
}

// ============================================================
// PRODUTOS
// ============================================================

// Listar produtos com paginação
async function listarProdutos({ pagina = 1, limite = 50, nome = '', situacao = '' } = {}) {
  const params = { pagina, limite };
  if (nome) params.nome = nome;
  if (situacao) params.situacao = situacao;

  return blingRequest('GET', '/produtos', null, params);
}

// Buscar produto por ID
async function buscarProduto(id) {
  return blingRequest('GET', `/produtos/${id}`);
}

// Criar produto no Bling
async function criarProduto(produto) {
  const payload = montarPayloadProduto(produto);
  return blingRequest('POST', '/produtos', payload);
}

// Atualizar produto
async function atualizarProduto(id, produto) {
  const payload = montarPayloadProduto(produto);
  return blingRequest('PUT', `/produtos/${id}`, payload);
}

// Deletar produto
async function deletarProduto(id) {
  return blingRequest('DELETE', `/produtos/${id}`);
}

// Buscar produto por código (OEM/SKU)
async function buscarPorCodigo(codigo) {
  return blingRequest('GET', '/produtos', null, { codigo, limite: 5 });
}

// ------------------------------------------------------------
// MONTAR PAYLOAD BLING (formato API v3)
// ------------------------------------------------------------
function montarPayloadProduto(p) {
  const payload = {
    nome: p.nome_completo || p.nome || '',
    codigo: p.sku || p.codigo || '',
    preco: parseFloat(p.preco || 0),
    situacao: p.situacao || 'A', // A = Ativo
    tipo: p.tipo || 'P', // P = Produto físico
    unidade: p.unidade || 'UN',
    descricaoCurta: p.descricao_curta || '',
    descricaoComplementar: p.descricao || '',
    observacoes: `Motor iRollo v3.0 | NCT: ${p.nct || '—'} | RAST-HASH: ${p.rast_hash || '—'} | ${p.motor_versao || ''}`,

    // Dados fiscais
    tributacao: {
      ncm: (p.ncm || '').replace(/\D/g, ''),
      origem: parseInt(p.origem || 0)
    }
  };

  // Estoque
  if (p.estoque !== undefined) {
    payload.estoque = {
      minimo: parseFloat(p.estoque_minimo || 0),
      maximo: parseFloat(p.estoque_maximo || 0),
      crossdocking: 0,
      localizacao: ''
    };
  }

  // Peso e medidas
  if (p.peso_bruto) {
    payload.pesoLiquido = parseFloat(p.peso_liquido || p.peso_bruto || 0);
    payload.pesoBruto = parseFloat(p.peso_bruto || 0);
    payload.largura = parseFloat(p.largura || 0);
    payload.altura = parseFloat(p.altura || 0);
    payload.profundidade = parseFloat(p.profundidade || 0);
  }

  // Marca
  if (p.marca) {
    payload.marca = { nome: p.marca };
  }

  // Categoria
  if (p.categoria_id) {
    payload.categoria = { id: parseInt(p.categoria_id) };
  }

  // Remove campos vazios/null
  Object.keys(payload).forEach(k => {
    if (payload[k] === '' || payload[k] === null || payload[k] === undefined) {
      delete payload[k];
    }
  });

  return payload;
}

// ============================================================
// CATEGORIAS
// ============================================================
async function listarCategorias() {
  return blingRequest('GET', '/categorias/produtos');
}

async function criarCategoria(nome, idCategoriaPai = null) {
  const payload = { descricao: nome };
  if (idCategoriaPai) payload.categoriaPai = { id: idCategoriaPai };
  return blingRequest('POST', '/categorias/produtos', payload);
}

// ============================================================
// CONTATOS (fornecedores)
// ============================================================
async function buscarContato(nome) {
  return blingRequest('GET', '/contatos', null, { nome, limite: 5 });
}

// ============================================================
// TESTAR CONEXÃO
// ============================================================
async function testarConexao() {
  const resp = await blingRequest('GET', '/produtos', null, { limite: 1 });
  if (resp.ok) {
    return {
      ok: true,
      mensagem: 'Conexão Bling API v3 OK!',
      token_expira_em: new Date(tokenCache.expires_at).toISOString()
    };
  }
  return { ok: false, erro: resp.error };
}

module.exports = {
  listarProdutos,
  buscarProduto,
  criarProduto,
  atualizarProduto,
  deletarProduto,
  buscarPorCodigo,
  listarCategorias,
  criarCategoria,
  buscarContato,
  testarConexao,
  renovarToken,
  getToken
};
