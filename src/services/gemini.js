// GENESIS iROLLO v3.2 - MOTOR CRUZAMENTO + CLAUDE HAIKU
const axios = require('axios');
require('dotenv').config();

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';

async function chamarClaude(prompt, maxTokens) {
  maxTokens = maxTokens || 1500;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.length < 10) throw new Error('ANTHROPIC_API_KEY nao configurada');
  const resp = await axios.post(ANTHROPIC_URL,
    { model: MODEL, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] },
    { headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' } }
  );
  return (resp.data && resp.data.content && resp.data.content[0] ? resp.data.content[0].text : '').trim();
}

// Alias para compatibilidade
var chamarGemini = chamarClaude;

async function buscarNaWeb(codigo, marca) {
  marca = marca || '';
  var apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  var cx = process.env.GOOGLE_SEARCH_CX;
  if (!apiKey || !cx || apiKey === 'SUA_GOOGLE_SEARCH_API_KEY') return null;
  var resultados = [];
  var queries = [
    '"' + codigo + '" equivalente OR cruzamento OR codigo original autopeça',
    '"' + codigo + '" ' + marca + ' OEM referencia original codigo montadora'
  ];
  for (var i = 0; i < queries.length; i++) {
    try {
      var url = 'https://www.googleapis.com/customsearch/v1?key=' + apiKey + '&cx=' + cx + '&q=' + encodeURIComponent(queries[i]) + '&num=5&hl=pt-BR';
      var resp = await axios.get(url, { timeout: 6000 });
      var items = (resp.data && resp.data.items) ? resp.data.items : [];
      for (var j = 0; j < items.length; j++) {
        resultados.push({ fonte: items[j].displayLink, titulo: items[j].title, snippet: items[j].snippet, url: items[j].link });
      }
    } catch(e) { console.warn('[SEARCH]', e.message); }
  }
  return resultados.length > 0 ? resultados : null;
}

async function fetchPagina(url) {
  try {
    var resp = await axios.get(url, { timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'pt-BR' }, maxContentLength: 200000 });
    return (resp.data || '').toString().replace(/<script[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').substring(0,6000);
  } catch(e) { return null; }
}

async function cruzarCodigos(codigo, marca) {
  marca = marca || '';
  console.log('[CRUZAMENTO] Triangulando: ' + codigo + ' ' + marca);
  var resultadosWeb = await buscarNaWeb(codigo, marca);
  var contexto = '';
  if (resultadosWeb && resultadosWeb.length > 0) {
    contexto = 'DADOS DA WEB:\n' + resultadosWeb.map(function(r){ return '['+r.fonte+'] '+r.titulo+': '+r.snippet; }).join('\n');
    for (var i = 0; i < Math.min(2, resultadosWeb.length); i++) {
      var pg = await fetchPagina(resultadosWeb[i].url);
      if (pg) contexto += '\n\n[PAGINA ' + resultadosWeb[i].fonte + ']\n' + pg;
    }
  }
  var prompt = 'Voce e especialista em catalogos de autopecas automotivas.\n' +
    'CODIGO: ' + codigo + '\nMARCA: ' + (marca || 'nao informado') + '\n' +
    (contexto ? 'DADOS REAIS:\n' + contexto + '\n' : '(Sem dados reais - use conhecimento tecnico)\n') +
    'Retorne APENAS JSON valido (sem markdown):\n{\n' +
    '  "codigo_input": "' + codigo + '",\n' +
    '  "tipo_codigo": "OEM_AFTERMARKET | OEM_ORIGINAL | EAN | SKU",\n' +
    '  "marca_fabricante": "marca do produto",\n' +
    '  "nome_peca": "nome tecnico completo",\n' +
    '  "descricao_tecnica": "descricao de 3-4 frases com material e funcao",\n' +
    '  "codigo_original_montadora": "codigo OEM original ex: VW 02K141025E",\n' +
    '  "codigos_equivalentes": [{"marca":"VALEO","codigo":"XXX","tipo":"equivalente"}],\n' +
    '  "ean_codigos": ["7891234567890"],\n' +
    '  "aplicacao_veicular": [{"montadora":"Volkswagen","modelo":"Golf","anos":"1999-2005","motor":"1.6"}],\n' +
    '  "sistemas_veiculo": "Embreagem | Suspensao | Freios | Motor",\n' +
    '  "material_composicao": "materiais do produto",\n' +
    '  "dimensoes": {"diametro_mm":0,"espessura_mm":0,"peso_kg":0.0},\n' +
    '  "ncm": "8 digitos",\n' +
    '  "tags_google_shopping": ["tag1","tag2","tag3","tag4","tag5","tag6","tag7"],\n' +
    '  "garantia_cdc": "texto garantia CDC Art.8 Art.31",\n' +
    '  "nivel_confianca": 0.0,\n' +
    '  "fontes_consultadas": ["fontes usadas"]\n' +
    '}\nIMPORTANTE: SOMENTE o JSON.';
  try {
    var resposta = await chamarClaude(prompt, 2000);
    var jsonLimpo = resposta.replace(/```json|```/g, '').trim();
    return { ok: true, cruzamento: JSON.parse(jsonLimpo), fontes_reais: resultadosWeb ? resultadosWeb.map(function(r){return r.fonte;}) : [], dados_reais: !!resultadosWeb };
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
    return { ok: false, erro: resultado.erro, dados_parciais: { nome_enriquecido: nome || oem, descricao_tecnica: (nome||'Produto')+' - OEM: '+(oem||'-'), aplicacao_veicular: aplicacao||'-', reino:'MINERAL', ncm_sugerido: ncm||'87089900', confianca_enriquecimento: 0.3 } };
  }
  var c = resultado.cruzamento;
  var aplicacaoFormatada = Array.isArray(c.aplicacao_veicular)
    ? c.aplicacao_veicular.map(function(v){ return v.montadora+' '+v.modelo+' ('+v.anos+')'; }).join(' / ')
    : (c.aplicacao_veicular || aplicacao || '-');
  var dados = {
    nome_enriquecido: c.nome_peca,
    descricao_tecnica: c.descricao_tecnica,
    descricao_curta: (c.nome_peca + ' - ' + (c.codigo_original_montadora || oem || '')).substring(0,160),
    aplicacao_veicular: aplicacaoFormatada,
    reino: 'MINERAL',
    sistema_veiculo: c.sistemas_veiculo,
    material_composicao: c.material_composicao,
    ncm_sugerido: c.ncm || ncm || '87089900',
    peso_estimado_kg: c.dimensoes ? c.dimensoes.peso_kg : 0,
    tags_seo: c.tags_google_shopping || [],
    garantia_cdc: c.garantia_cdc,
    confianca_enriquecimento: c.nivel_confianca || 0.7,
    cruzamento: { codigo_original_montadora: c.codigo_original_montadora, codigos_equivalentes: c.codigos_equivalentes || [], ean_codigos: c.ean_codigos || [], dimensoes: c.dimensoes, tipo_codigo: c.tipo_codigo, fontes: resultado.fontes_reais }
  };
  return { ok: true, dados: dados, modelo_usado: MODEL, fonte_real: resultado.dados_reais, enriquecido_em: new Date().toISOString() };
}

async function gerarTituloSEO(produto) {
  var prompt = 'Gere UM UNICO titulo SEO para Google Shopping de autopecas.\nFormato: [Nome Peca] [Marca] [Codigo OEM] [Aplicacao Veicular]\nMaximo: 150 caracteres.\nProduto: '+(produto.nome||'')+' | OEM: '+(produto.oem||'')+' | Aplicacao: '+(produto.aplicacao||'')+'\nResponda APENAS o titulo.';
  try { var titulo = await chamarClaude(prompt, 150); return { ok: true, titulo: titulo.replace(/['"/]/g,'').trim() }; }
  catch(e) { return { ok: false, titulo: produto.nome, erro: e.message }; }
}

async function validarImagem(base64Image, nomeProduto) {
  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.length < 10) return { ok: false, erro: 'ANTHROPIC_API_KEY nao configurada', confianca: 0 };
  try {
    var resp = await axios.post(ANTHROPIC_URL,
      { model: MODEL, max_tokens: 50, messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64Image } },
        { type: 'text', text: 'Esta imagem mostra um(a) "'+nomeProduto+'"? Responda: SIM ou NAO, virgula e 0-100. Ex: SIM, 92' }
      ]}] },
      { headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' } }
    );
    var texto = (resp.data && resp.data.content && resp.data.content[0]) ? resp.data.content[0].text : 'NAO, 0';
    var partes = texto.split(',');
    var decisao = partes[0].trim().toUpperCase();
    var confianca = parseInt(partes[1] ? partes[1].trim() : '0');
    return { ok: true, valida: decisao === 'SIM' && confianca >= 85, decisao: decisao, confianca: confianca, aprovada: confianca >= 85 };
  } catch(e) { return { ok: false, erro: e.message, confianca: 0 }; }
}

async function enriquecerLote(produtos, delayMs) {
  delayMs = delayMs || 800;
  var resultados = [];
  for (var i = 0; i < produtos.length; i++) {
    var p = produtos[i];
    console.log('[MOTOR] Cruzando ' + (i+1) + '/' + produtos.length + ': ' + (p.oem || p.nome));
    resultados.push(Object.assign({}, p, { enriquecimento: await enriquecerProduto(p) }));
    if (i < produtos.length - 1) await new Promise(function(r){ setTimeout(r, delayMs); });
  }
  return resultados;
}

module.exports = { enriquecerProduto: enriquecerProduto, gerarTituloSEO: gerarTituloSEO, validarImagem: validarImagem, enriquecerLote: enriquecerLote, chamarGemini: chamarGemini, cruzarCodigos: cruzarCodigos };