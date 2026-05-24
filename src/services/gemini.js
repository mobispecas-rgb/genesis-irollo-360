// GENESIS iROLLO v3.3 - MOTOR CRUZAMENTO REAL + IMAGEM REAL + SEM ALUCINACAO
// Claude Haiku (Anthropic) - nao inventa, so usa dados reais da web
const axios = require('axios');
require('dotenv').config();

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';

// Sites brasileiros com dados reais de autopecas (testados e aprovados)
var SITES_REAIS = [
  'krambeck.com.br',
  'zenoautopecas.com.br',
  'autoz.com.br',
  'enviapecas.com.br',
  'natparts.com.br',
  'autopecascomp.com.br',
  'mercadolivre.com.br',
  'autodoc.com.br',
  'grupopecasecia.com.br',
  'pecashonda.com.br'
];

async function chamarClaude(prompt, maxTokens) {
  maxTokens = maxTokens || 1500;
  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.length < 10) throw new Error('ANTHROPIC_API_KEY nao configurada');
  var resp = await axios.post(ANTHROPIC_URL,
    { model: MODEL, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] },
    { headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' } }
  );
  return (resp.data && resp.data.content && resp.data.content[0] ? resp.data.content[0].text : '').trim();
}
var chamarGemini = chamarClaude;

// Extrai imagem real de pagina HTML
function extrairImagemDaPagina(html, urlBase) {
  if (!html) return null;
  // Busca tags img com src que pareca foto de produto
  var padroes = [
    /og:image[^>]*content=["']([^"']+)["']/i,
    /twitter:image[^>]*content=["']([^"']+)["']/i,
    /<img[^>]*(product|produto|foto|photo|main|principal)[^>]*src=["']([^"']+)["']/i,
    /<img[^>]*src=["'](https?:[^"']+\.(jpg|jpeg|png|webp))["'][^>]*>/i
  ];
  for (var i = 0; i < padroes.length; i++) {
    var m = html.match(padroes[i]);
    if (m) {
      var url = m[2] || m[1];
      if (url && url.startsWith('http') && url.length > 20) return url;
      if (url && url.startsWith('/') && urlBase) return urlBase + url;
    }
  }
  return null;
}

async function buscarNaWeb(codigo, marca) {
  marca = marca || '';
  var apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  var cx = process.env.GOOGLE_SEARCH_CX;
  if (!apiKey || !cx || apiKey === 'SUA_GOOGLE_SEARCH_API_KEY') return null;
  var sitesStr = SITES_REAIS.map(function(s){ return 'site:'+s; }).join(' OR ');
  var queries = [
    '"' + codigo + '" (' + sitesStr + ')',
    '"' + codigo + '" ' + marca + ' aplicacao ano modelo embreagem'
  ];
  var resultados = [];
  for (var i = 0; i < queries.length; i++) {
    try {
      var url = 'https://www.googleapis.com/customsearch/v1?key='+apiKey+'&cx='+cx+'&q='+encodeURIComponent(queries[i])+'&num=5&hl=pt-BR';
      var resp = await axios.get(url, { timeout: 6000 });
      var items = (resp.data && resp.data.items) ? resp.data.items : [];
      for (var j = 0; j < items.length; j++) {
        resultados.push({ fonte: items[j].displayLink, titulo: items[j].title, snippet: items[j].snippet, url: items[j].link,
          imagem: (items[j].pagemap && items[j].pagemap.cse_image && items[j].pagemap.cse_image[0]) ? items[j].pagemap.cse_image[0].src : null
        });
      }
    } catch(e) { console.warn('[SEARCH]', e.message); }
  }
  return resultados.length > 0 ? resultados : null;
}

async function fetchPaginaComImagem(item) {
  try {
    var resp = await axios.get(item.url, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Accept-Language': 'pt-BR,pt;q=0.9' },
      maxContentLength: 300000
    });
    var html = (resp.data || '').toString();
    var imagemUrl = item.imagem || extrairImagemDaPagina(html, 'https://'+item.fonte);
    var texto = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .substring(0, 6000);
    return { texto: texto, imagemUrl: imagemUrl, fonte: item.fonte };
  } catch(e) { return { texto: null, imagemUrl: item.imagem || null, fonte: item.fonte }; }
}

async function cruzarCodigos(codigo, marca) {
  marca = marca || '';
  console.log('[CRUZAMENTO v3.3] Buscando dados reais: ' + codigo + ' ' + marca);
  var resultadosWeb = await buscarNaWeb(codigo, marca);
  var contexto = '';
  var imagemReal = null;
  var fontesUsadas = [];

  if (resultadosWeb && resultadosWeb.length > 0) {
    // Pega imagem da busca (Google CSE pagemap)
    for (var k = 0; k < resultadosWeb.length; k++) {
      if (resultadosWeb[k].imagem && !imagemReal) { imagemReal = resultadosWeb[k].imagem; }
    }
    // Snippets como contexto
    contexto = 'DADOS ENCONTRADOS NA WEB:\n' + resultadosWeb.map(function(r){ return '['+r.fonte+'] '+r.titulo+': '+r.snippet; }).join('\n');
    fontesUsadas = resultadosWeb.map(function(r){ return r.fonte; });
    // Fetch das 2 primeiras paginas para mais dados e imagem
    for (var i = 0; i < Math.min(2, resultadosWeb.length); i++) {
      var paginaDados = await fetchPaginaComImagem(resultadosWeb[i]);
      if (paginaDados.imagemUrl && !imagemReal) imagemReal = paginaDados.imagemUrl;
      if (paginaDados.texto) contexto += '\n[PAGINA:' + paginaDados.fonte + ']\n' + paginaDados.texto;
    }
  }

  // Prompt anti-alucinacao: so usa o que achou, nunca inventa
  var temDadosReais = contexto.length > 50;
  var prompt = 'Voce e um motor de catalogacao de autopecas. NUNCA invente dados.\n' +
    'CODIGO: ' + codigo + ' | MARCA: ' + (marca||'desconhecida') + '\n' +
    (temDadosReais ?
      'USE SOMENTE os dados abaixo. Se um campo nao estiver nos dados, coloque null.\n' + contexto :
      'ATENCAO: Sem dados reais encontrados. Preencha somente o que voce tem certeza absoluta. Use null para o resto.') + '\n\n' +
    'Retorne APENAS JSON (sem markdown):\n{\n' +
    '"codigo_input":"' + codigo + '",\n' +
    '"tipo_codigo":"OEM_AFTERMARKET|OEM_ORIGINAL|EAN|SKU",\n' +
    '"marca_fabricante":"marca real ou null",\n' +
    '"nome_peca":"nome tecnico exato ou null",\n' +
    '"descricao_tecnica":"so com dados reais ou null",\n' +
    '"codigo_original_montadora":"codigo OEM fabrica ou null",\n' +
    '"codigos_equivalentes":[{"marca":"X","codigo":"X","tipo":"equivalente"}],\n' +
    '"ean_codigos":["somente se encontrado"],\n' +
    '"aplicacao_veicular":[{"montadora":"X","modelo":"X","anos":"X","motor":"X"}],\n' +
    '"sistemas_veiculo":"sistema real ou null",\n' +
    '"material_composicao":"material real ou null",\n' +
    '"dimensoes":{"diametro_mm":0,"espessura_mm":0,"peso_kg":0.0},\n' +
    '"ncm":"8 digitos",\n' +
    '"tags_google_shopping":["tag1","tag2","tag3","tag4","tag5","tag6","tag7"],\n' +
    '"garantia_cdc":"texto CDC Art.8 Art.31",\n' +
    '"nivel_confianca":' + (temDadosReais ? '0.9' : '0.3') + ',\n' +
    '"fontes_consultadas":["lista das fontes"]\n' +
    '}';

  try {
    var resposta = await chamarClaude(prompt, 2000);
    var jsonLimpo = resposta.replace(/```json|```/g, '').trim();
    var cruzamento = JSON.parse(jsonLimpo);
    return { ok: true, cruzamento: cruzamento, imagem_real: imagemReal, fontes_reais: fontesUsadas, dados_reais: temDadosReais };
  } catch(e) {
    console.error('[CRUZAMENTO] Erro:', e.message);
    return { ok: false, erro: e.message };
  }
}

async function enriquecerProduto(dadosBrutos) {
  var oem = dadosBrutos.oem, nome = dadosBrutos.nome, ncm = dadosBrutos.ncm, sku = dadosBrutos.sku, aplicacao = dadosBrutos.aplicacao;
  var marcaDetectada = nome ? nome.split(' ')[0] : '';
  var codigoPrincipal = oem || sku || nome;
  var resultado = await cruzarCodigos(codigoPrincipal, marcaDetectada);
  if (!resultado.ok) {
    return { ok: false, erro: resultado.erro, dados_parciais: { nome_enriquecido: nome||oem, descricao_tecnica: (nome||'Produto')+' OEM:'+(oem||'-'), aplicacao_veicular: aplicacao||'-', reino:'MINERAL', ncm_sugerido: ncm||'87089900', confianca_enriquecimento: 0.3 } };
  }
  var c = resultado.cruzamento;
  var aplicacaoFormatada = Array.isArray(c.aplicacao_veicular) && c.aplicacao_veicular.length > 0
    ? c.aplicacao_veicular.map(function(v){ return (v.montadora||'')+' '+(v.modelo||'')+' ('+(v.anos||'')+') '+(v.motor||''); }).join(' / ')
    : (aplicacao || '-');
  var dados = {
    nome_enriquecido: c.nome_peca || nome || oem,
    descricao_tecnica: c.descricao_tecnica || ((nome||'Produto')+' OEM:'+(oem||'-')),
    descricao_curta: ((c.nome_peca||nome||'') + ' - ' + (c.codigo_original_montadora||oem||'')).substring(0,160),
    aplicacao_veicular: aplicacaoFormatada,
    reino: 'MINERAL',
    sistema_veiculo: c.sistemas_veiculo || 'Embreagem',
    material_composicao: c.material_composicao || null,
    ncm_sugerido: c.ncm || ncm || '87089900',
    peso_estimado_kg: (c.dimensoes && c.dimensoes.peso_kg) ? c.dimensoes.peso_kg : 0,
    tags_seo: c.tags_google_shopping || [],
    garantia_cdc: c.garantia_cdc || null,
    confianca_enriquecimento: c.nivel_confianca || 0.7,
    imagem_real: resultado.imagem_real || null,
    cruzamento: {
      codigo_original_montadora: c.codigo_original_montadora || null,
      codigos_equivalentes: c.codigos_equivalentes || [],
      ean_codigos: c.ean_codigos || [],
      dimensoes: c.dimensoes || null,
      tipo_codigo: c.tipo_codigo || null,
      fontes: resultado.fontes_reais || []
    }
  };
  return { ok: true, dados: dados, modelo_usado: MODEL, fonte_real: resultado.dados_reais, enriquecido_em: new Date().toISOString() };
}

async function gerarTituloSEO(produto) {
  var prompt = 'Gere UM titulo SEO para Google Shopping de autopecas. Formato: [Peca] [Marca] [OEM] [Aplicacao]. Max 150 chars.\nProduto:'+( produto.nome||'')+' OEM:'+(produto.oem||'')+' Aplicacao:'+(produto.aplicacao||'')+'\nSO o titulo.';
  try { var t = await chamarClaude(prompt, 150); return { ok: true, titulo: t.replace(/['"/]/g,'').trim() }; }
  catch(e) { return { ok: false, titulo: produto.nome, erro: e.message }; }
}

async function validarImagem(base64Image, nomeProduto) {
  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.length < 10) return { ok: false, erro: 'ANTHROPIC_API_KEY nao configurada', confianca: 0 };
  try {
    var resp = await axios.post(ANTHROPIC_URL,
      { model: MODEL, max_tokens: 50, messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64Image } },
        { type: 'text', text: 'Esta imagem mostra um(a) "'+nomeProduto+'"? Responda: SIM ou NAO, virgula e 0-100. Ex: SIM,92' }
      ]}] },
      { headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' } }
    );
    var texto = resp.data.content[0].text || 'NAO,0';
    var p = texto.split(',');
    var decisao = p[0].trim().toUpperCase();
    var confianca = parseInt(p[1]?p[1].trim():'0');
    return { ok: true, valida: decisao==='SIM'&&confianca>=85, decisao: decisao, confianca: confianca, aprovada: confianca>=85 };
  } catch(e) { return { ok: false, erro: e.message, confianca: 0 }; }
}

async function enriquecerLote(produtos, delayMs) {
  delayMs = delayMs || 800;
  var resultados = [];
  for (var i = 0; i < produtos.length; i++) {
    var p = produtos[i];
    console.log('[MOTOR v3.3] ' + (i+1) + '/' + produtos.length + ': ' + (p.oem||p.nome));
    resultados.push(Object.assign({}, p, { enriquecimento: await enriquecerProduto(p) }));
    if (i < produtos.length - 1) await new Promise(function(r){ setTimeout(r, delayMs); });
  }
  return resultados;
}

module.exports = { enriquecerProduto: enriquecerProduto, gerarTituloSEO: gerarTituloSEO, validarImagem: validarImagem, enriquecerLote: enriquecerLote, chamarGemini: chamarGemini, cruzarCodigos: cruzarCodigos };