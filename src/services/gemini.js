// ============================================================
// GENESIS iROLLO v3.5 - MOTOR DE CRUZAMENTO REAL + FALLBACK TECNICO
// IA: Claude Haiku (Anthropic)
// Modo 1 (Google Search ON): usa dados reais da web - confianca 0.9
// Modo 2 (Google Search OFF): usa base tecnica do Claude - confianca 0.7
// ============================================================
const axios = require('axios');
require('dotenv').config();

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';

const CLAUDE_HEADERS = {
  'x-api-key': '',
  'anthropic-version': '2023-06-01',
  'content-type': 'application/json'
};

const SITES_REAIS = [
  'krambeck.com.br', 'zenoautopecas.com.br', 'autoz.com.br',
  'enviapecas.com.br', 'natparts.com.br', 'autopecascomp.com.br',
  'mercadolivre.com.br', 'autodoc.com.br', 'grupopecasecia.com.br', 'pecashonda.com.br'
];

async function chamarClaude(prompt, maxTokens) {
  maxTokens = maxTokens || 1500;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.length < 10) throw new Error('ANTHROPIC_API_KEY nao configurada');
  const resp = await axios.post(ANTHROPIC_URL, {
    model: MODEL, max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }]
  }, { headers: Object.assign({}, CLAUDE_HEADERS, { 'x-api-key': apiKey }) });
  return (resp.data && resp.data.content && resp.data.content[0] && resp.data.content[0].text || '').trim();
}
const chamarGemini = chamarClaude;

function extrairImagemDaPagina(html, urlBase) {
  if (!html) return null;
  const padroes = [
    /og:image[^>]*content=["']([^"']+)["']/i,
    /twitter:image[^>]*content=["']([^"']+)["']/i,
    /<img[^>]*(product|produto|foto|photo|main|principal)[^>]*src=["']([^"']+\.(jpg|jpeg|png|webp))["']/i,
    /<img[^>]*src=["'](https?:[^"']+\.(jpg|jpeg|png|webp))["'][^>]*>/i
  ];
  for (let i = 0; i < padroes.length; i++) {
    const match = html.match(padroes[i]);
    if (match) {
      const url = (i === 2) ? match[2] : match[1];
      if (!url) continue;
      if (url.startsWith('//')) return 'https:' + url;
      if (url.startsWith('/') && urlBase) {
        try { const base = new URL(urlBase); return base.origin + url; } catch(e) { return url; }
      }
      return url;
    }
  }
  return null;
}

async function buscarNaWeb(codigo, marca) {
  marca = marca || '';
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_CX;
  if (!apiKey || !cx || apiKey === 'SUA_GOOGLE_SEARCH_API_KEY') return null;
  const sitesStr = SITES_REAIS.map(function(s) { return 'site:' + s; }).join(' OR ');
  const queries = [
    '"' + codigo + '" equivalente OR cruzamento OR "codigo original" autopeca',
    '"' + codigo + '" ' + marca + ' (' + sitesStr + ')'
  ];
  const resultados = [];
  const imagensEncontradas = [];
  for (let q = 0; q < queries.length; q++) {
    try {
      const url = 'https://www.googleapis.com/customsearch/v1?key=' + apiKey + '&cx=' + cx + '&q=' + encodeURIComponent(queries[q]) + '&num=5&hl=pt-BR';
      const resp = await axios.get(url, { timeout: 6000 });
      const items = (resp.data && resp.data.items) || [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        resultados.push({ fonte: item.displayLink, titulo: item.title, snippet: item.snippet, url: item.link });
        if (item.pagemap) {
          const cse = item.pagemap.cse_image;
          const og = item.pagemap.metatags;
          if (cse && cse[0] && cse[0].src) imagensEncontradas.push(cse[0].src);
          else if (og && og[0] && og[0]['og:image']) imagensEncontradas.push(og[0]['og:image']);
        }
      }
    } catch(err) { console.warn('[SEARCH] Erro:', err.message); }
  }
  return resultados.length > 0 ? { resultados: resultados, imagem_pagemap: imagensEncontradas[0] || null } : null;
}

async function fetchPaginaComImagem(item) {
  try {
    const resp = await axios.get(item.url, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GenesisiRollo/3.4)', 'Accept': 'text/html', 'Accept-Language': 'pt-BR,pt;q=0.9' },
      maxContentLength: 300000
    });
    const html = resp.data || '';
    const imagem = extrairImagemDaPagina(html, item.url);
    const texto = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').substring(0,8000);
    return { texto: texto, imagem: imagem };
  } catch(err) { return null; }
}

async function cruzarCodigos(codigo, marca) {
  marca = marca || '';
  console.log('[CRUZAMENTO] v3.4 - Iniciando: ' + codigo + ' ' + marca);
  const webResult = await buscarNaWeb(codigo, marca);
  const resultadosWeb = webResult ? webResult.resultados : null;
  const imagemPagemap = webResult ? webResult.imagem_pagemap : null;
  let dadosBrutos = '';
  let imagemReal = imagemPagemap || null;
  const temDadosReais = !!(resultadosWeb && resultadosWeb.length > 0);
  // Se nao tem Google Search API, tenta busca direta nos catalogos
  if (!imagemReal && !temDadosReais) {
    try {
      imagemReal = await buscarImagemCatalogoDireto(codigo, marca);
    } catch(e) { /* continua sem imagem */ }
  }
  if (temDadosReais) {
    const paginasFetched = [];
    for (let i = 0; i < Math.min(2, resultadosWeb.length); i++) {
      const item = resultadosWeb[i];
      if (item.url) {
        const pagina = await fetchPaginaComImagem(item);
        if (pagina) {
          paginasFetched.push('=== Fonte: ' + item.fonte + ' ===\n' + pagina.texto);
          if (!imagemReal && pagina.imagem) imagemReal = pagina.imagem;
        }
      }
    }
    const snippets = resultadosWeb.map(function(r) { return '[' + r.fonte + '] ' + r.titulo + ': ' + r.snippet; }).join('\n');
    dadosBrutos = 'SNIPPETS DE BUSCA:\n' + snippets;
    if (paginasFetched.length > 0) dadosBrutos += '\n\nCONTEUDO REAL DE PAGINAS:\n' + paginasFetched.join('\n\n');
  }
  // Prompt diferente dependendo se tem dados reais ou nao
  var instrucaoFonte, nivelConfiancaBase;
  if (temDadosReais) {
    instrucaoFonte = 'USE PRIORITARIAMENTE os dados reais abaixo. Complemente com conhecimento tecnico quando necessario.\n\nDADOS REAIS DA WEB:\n' + dadosBrutos;
    nivelConfiancaBase = '0.9';
  } else {
    instrucaoFonte = 'NAO HA dados da web para este codigo.';
    nivelConfiancaBase = '0.5';
    restricaoSemWeb = [
      '',
      'REGRA CRITICA iRollo v3.5:',
      'aplicacao_veicular: [] OBRIGATORIO - NUNCA inventar aplicacoes sem fonte real',
      'codigos_equivalentes: [] OBRIGATORIO - NUNCA inventar equivalentes',
      'ean_codigos: [] OBRIGATORIO - NUNCA inventar EANs',
      'codigo_original_montadora: null - OBRIGATORIO sem fonte',
      'Pode preencher: nome_peca, marca_fabricante, sistemas_veiculo, material_composicao',
      'ncm: null se houver qualquer duvida sobre o codigo correto'
    ].join('\n');
  }
  const prompt = [
    'Voce e um especialista em catalogos tecnicos de autopecas automotivas.',
    instrucaoFonte,
    '',
    'CODIGO: ' + codigo + ' | MARCA: ' + (marca || 'nao informado'),
    '',
    'Retorne APENAS um JSON valido (sem markdown):',
    '{',
    '  "codigo_input": "' + codigo + '",',
    '  "tipo_codigo": "OEM_AFTERMARKET | OEM_ORIGINAL | EAN | SKU",',
    '  "marca_fabricante": "ex: LUK, VALEO, SACHS",',
    '  "nome_peca": "Nome tecnico completo da peca",',
    '  "descricao_tecnica": "Descricao tecnica 2-3 frases",',
    '  "codigo_original_montadora": "Codigo OEM da montadora ou null",',
    '  "codigos_equivalentes": [],',
    '  "ean_codigos": [],',
    '  "aplicacao_veicular": [],',
    '  "sistemas_veiculo": "Embreagem | Suspensao | Freios | Motor",',
    '  "material_composicao": "materiais ou null",',
    '  "dimensoes": {"diametro_mm": null, "espessura_mm": null, "peso_kg": null},',
    '  "ncm": "8 digitos ou null",',
    '  "tags_google_shopping": [],',
    '  "garantia_cdc": "Garantia conforme CDC ou null",',
    '  "nivel_confianca": ' + nivelConfiancaBase + ',',
    '  "fontes_consultadas": []',
    '}',
    '',
    'codigos_equivalentes: [{"marca":"VALEO","codigo":"XXX","tipo":"equivalente"}]',
    'aplicacao_veicular: [{"montadora":"Hyundai","modelo":"HR","anos":"2006-2012","motor":"2.5 8V Diesel"}]',
    'IMPORTANTE: Responda SOMENTE o JSON.'
  ].join('\n');
  try {
    const resposta = await chamarClaude(prompt, 2000);
    const jsonLimpo = resposta.replace(/```json|```/g,'').trim();
    return { ok: true, cruzamento: JSON.parse(jsonLimpo), imagem_real: imagemReal, fontes_reais: resultadosWeb ? resultadosWeb.map(function(r){return r.fonte;}) : [], dados_reais: temDadosReais };
  } catch(err) {
    console.error('[CRUZAMENTO] Erro:', err.message);
    return { ok: false, erro: err.message };
  }
}

async function enriquecerProduto(dadosBrutos) {
  const oem = dadosBrutos.oem, nome = dadosBrutos.nome, ncm = dadosBrutos.ncm, sku = dadosBrutos.sku, aplicacao = dadosBrutos.aplicacao;
  const marcaDetectada = nome ? nome.split(' ')[0] : '';
  const codigoPrincipal = oem || sku || nome;
  const resultado = await cruzarCodigos(codigoPrincipal, marcaDetectada);
  if (!resultado.ok) {
    return { ok: false, erro: resultado.erro, dados_parciais: { nome_enriquecido: nome||oem, descricao_tecnica: (nome||'Produto')+' - OEM: '+(oem||'-'), aplicacao_veicular: aplicacao||'-', reino:'MINERAL', ncm_sugerido: ncm||'87089900', confianca_enriquecimento: 0.3 } };
  }
  const c = resultado.cruzamento;
  const aplicacaoFormatada = Array.isArray(c.aplicacao_veicular) && c.aplicacao_veicular.length > 0
    ? c.aplicacao_veicular.map(function(v){return (v.montadora||'')+' '+(v.modelo||'')+' ('+(v.anos||'')+')'}).join(' / ')
    : (resultado.dados_reais ? (aplicacao || '') : '')
  const dados = {
    nome_enriquecido: c.nome_peca,
    descricao_tecnica: c.descricao_tecnica,
    descricao_curta: ((c.nome_peca||'')+' - '+(c.codigo_original_montadora||oem||'')).substring(0,160),
    aplicacao_veicular: aplicacaoFormatada,
    imagem_real: resultado.imagem_real || null,
    reino: 'MINERAL',
    sistema_veiculo: c.sistemas_veiculo,
    material_composicao: c.material_composicao,
    ncm_sugerido: c.ncm||ncm||'87089900',
    peso_estimado_kg: (c.dimensoes && c.dimensoes.peso_kg) || 0,
    tags_seo: c.tags_google_shopping || [],
    garantia_cdc: c.garantia_cdc,
    confianca_enriquecimento: c.nivel_confianca || 0.7,
    cruzamento: { codigo_original_montadora: c.codigo_original_montadora, codigos_equivalentes: c.codigos_equivalentes||[], ean_codigos: c.ean_codigos||[], dimensoes: c.dimensoes, tipo_codigo: c.tipo_codigo, fontes: resultado.fontes_reais }
  };
  return { ok: true, dados: dados, modelo_usado: MODEL, fonte_real: resultado.dados_reais, enriquecido_em: new Date().toISOString() };
}

async function gerarTituloSEO(produto) {
  const prompt = 'Gere UM UNICO titulo SEO para Google Shopping de autopecas.\nFormato: [Nome Peca] [Marca] [Codigo OEM] [Aplicacao Principal]\nMaximo: 150 chars.\nProduto: '+(produto.nome||'')+' | OEM: '+(produto.oem||'')+' | Aplicacao: '+(produto.aplicacao||'')+'\nResponda APENAS o titulo.';
  try {
    const titulo = await chamarClaude(prompt, 150);
    return { ok: true, titulo: titulo.replace(/["']/g,'').trim() };
  } catch(err) { return { ok: false, titulo: produto.nome, erro: err.message }; }
}

async function validarImagem(base64Image, nomeProduto) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.length < 10) return { ok: false, erro: 'ANTHROPIC_API_KEY nao configurada', confianca: 0 };
  try {
    const resp = await axios.post(ANTHROPIC_URL, { model: MODEL, max_tokens: 50, messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64Image } },
      { type: 'text', text: 'Esta imagem mostra um(a) "'+nomeProduto+'"? Responda APENAS: SIM ou NAO, virgula e numero 0-100. Ex: SIM, 92' }
    ]}]}, { headers: Object.assign({}, CLAUDE_HEADERS, {'x-api-key': apiKey}) });
    const texto = (resp.data&&resp.data.content&&resp.data.content[0]&&resp.data.content[0].text)||'NAO, 0';
    const partes = texto.split(',');
    const decisao = partes[0].trim().toUpperCase();
    const confianca = parseInt(partes[1]&&partes[1].trim()||0);
    return { ok: true, valida: decisao==='SIM'&&confianca>=85, decisao: decisao, confianca: confianca, aprovada: confianca>=85 };
  } catch(err) { return { ok: false, erro: err.message, confianca: 0 }; }
}

async function enriquecerLote(produtos, delayMs) {
  delayMs = delayMs || 800;
  const resultados = [];
  for (let i = 0; i < produtos.length; i++) {
    const p = produtos[i];
    console.log('[MOTOR] Cruzando '+(i+1)+'/'+produtos.length+': '+(p.oem||p.nome));
    const resultado = await enriquecerProduto(p);
    resultados.push(Object.assign({}, p, { enriquecimento: resultado }));
    if (i < produtos.length-1) await new Promise(function(r){ setTimeout(r, delayMs); });
  }
  return resultados;
}

module.exports = {
  enriquecerProduto: enriquecerProduto,
  gerarTituloSEO: gerarTituloSEO,
  validarImagem: validarImagem,
  enriquecerLote: enriquecerLote,
  chamarGemini: chamarGemini,
  cruzarCodigos: cruzarCodigos
};