// ============================================================
// GENESIS iROLLO v3.2 — MOTOR DE CRUZAMENTO REAL
// Triangulação OEM → Código Original → Equivalentes → EAN
// Fontes: AutoDoc, Mekonomen, TecDoc, Google Catalogs
// IA: Claude Haiku (Anthropic) para extração estruturada
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

const SITES_CATALOGO = [
  'autodoc.com.br','mekonomen.com.br','europarts.com.br',
  'natparts.com.br','pecasearch.com.br','repuestosnew.com',
  'autopecasonline.com.br','worldautoparts.net'
];

async function chamarGemini(prompt, maxTokens = 1500) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.length < 10) throw new Error('ANTHROPIC_API_KEY não configurada no Render');

  const resp = await axios.post(ANTHROPIC_URL,
    { model: MODEL, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] },
    { headers: { ...CLAUDE_HEADERS, 'x-api-key': apiKey } }
  );
  return (resp.data?.content?.[0]?.text || '').trim();
}

async function buscarNaWeb(codigo, marca = '') {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx     = process.env.GOOGLE_SEARCH_CX;
  if (!apiKey || !cx || apiKey === 'SUA_GOOGLE_SEARCH_API_KEY') return null;

  const sitesStr = SITES_CATALOGO.map(s => `site:${s}`).join(' OR ');
  const queries = [
    `"${codigo}" equivalente OR cruzamento OR "código original" autopeça`,
    `"${codigo}" ${marca} (${sitesStr})`,
    `"${codigo}" OEM OR "referência original" OR "código montadora"`
  ];

  const resultados = [];
  for (const query of queries) {
    try {
      const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&num=5&hl=pt-BR`;
      const resp = await axios.get(url, { timeout: 6000 });
      for (const item of (resp.data?.items || [])) {
        resultados.push({ fonte: item.displayLink, titulo: item.title, snippet: item.snippet, url: item.link });
      }
    } catch (err) { console.warn('[SEARCH]', err.message); }
  }
  return resultados.length > 0 ? resultados : null;
}

async function fetchPagina(url) {
  try {
    const resp = await axios.get(url, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GenesisiRollo/3.2)', 'Accept-Language': 'pt-BR,pt;q=0.9' },
      maxContentLength: 300000
    });
    return (resp.data || '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .substring(0, 8000);
  } catch (err) { return null; }
}

async function cruzarCodigos(codigo, marca = '') {
  console.log(`[CRUZAMENTO] Triangulando: ${codigo} ${marca}`);

  const resultadosWeb = await buscarNaWeb(codigo, marca);
  let dadosBrutos = '';

  if (resultadosWeb && resultadosWeb.length > 0) {
    const paginasFetched = [];
    for (let i = 0; i < Math.min(2, resultadosWeb.length); i++) {
      if (resultadosWeb[i].url) {
        const conteudo = await fetchPagina(resultadosWeb[i].url);
        if (conteudo) paginasFetched.push(`=== ${resultadosWeb[i].fonte} ===\n${conteudo}`);
      }
    }
    dadosBrutos = 'SNIPPETS:\n' + resultadosWeb.map(r => `[${r.fonte}] ${r.titulo}: ${r.snippet}`).join('\n');
    if (paginasFetched.length > 0) dadosBrutos += '\n\nCONTEÚDO REAL:\n' + paginasFetched.join('\n\n');
  }

  const prompt = `Você é um especialista em catálogos técnicos de autopeças automotivas brasileiras.

CÓDIGO PARA CRUZAR: ${codigo}
MARCA/FABRICANTE: ${marca || 'não informado'}

${dadosBrutos ? `DADOS REAIS DA WEB:\n${dadosBrutos}\n` : '(Sem dados reais — use conhecimento técnico de catálogos)'}

Analise e retorne APENAS um JSON válido (sem markdown):
{
  "codigo_input": "${codigo}",
  "tipo_codigo": "OEM_AFTERMARKET | OEM_ORIGINAL | EAN | SKU | REFERENCIA",
  "marca_fabricante": "Ex: LUK, VALEO, COFAP, BOSCH",
  "nome_peca": "Nome técnico completo da peça",
  "descricao_tecnica": "Descrição técnica de 3-4 frases: função, material, características",
  "codigo_original_montadora": "Código OEM original da montadora (ex: VW 02K141025E)",
  "codigos_equivalentes": [
    {"marca": "VALEO", "codigo": "XXXXXXX", "tipo": "equivalente"},
    {"marca": "SACHS", "codigo": "XXXXXXX", "tipo": "equivalente"},
    {"marca": "COFAP", "codigo": "XXXXXXX", "tipo": "nacional"}
  ],
  "ean_codigos": ["7891234567890"],
  "aplicacao_veicular": [
    {"montadora": "Volkswagen", "modelo": "Golf", "anos": "1999-2005", "motor": "1.6 / 2.0"}
  ],
  "sistemas_veiculo": "Embreagem | Suspensão | Freios | Motor | etc",
  "material_composicao": "Materiais do produto",
  "dimensoes": {"diametro_mm": 0, "espessura_mm": 0, "peso_kg": 0.0},
  "ncm": "8 dígitos",
  "tags_google_shopping": ["tag1","tag2","tag3","tag4","tag5","tag6","tag7"],
  "garantia_cdc": "Texto garantia conforme CDC Art.8 e Art.31",
  "nivel_confianca": 0.0,
  "fontes_consultadas": ["fontes usadas"]
}

IMPORTANTE: Responda SOMENTE o JSON. Mais códigos equivalentes = menor CPC no Google Shopping.`;

  try {
    const resposta = await chamarGemini(prompt, 2000);
    const jsonLimpo = resposta.replace(/```json|```/g, '').trim();
    return { ok: true, cruzamento: JSON.parse(jsonLimpo), fontes_reais: resultadosWeb?.map(r => r.fonte) || [], dados_reais: !!resultadosWeb };
  } catch (err) {
    console.error('[CRUZAMENTO] Erro:', err.message);
    return { ok: false, erro: err.message };
  }
}

async function enriquecerProduto(dadosBrutos) {
  const { oem, nome, ncm, sku, aplicacao } = dadosBrutos;
  const marcaDetectada = nome ? nome.split(' ')[0] : '';
  const codigoPrincipal = oem || sku || nome;

  const resultado = await cruzarCodigos(codigoPrincipal, marcaDetectada);

  if (!resultado.ok) {
    return {
      ok: false, erro: resultado.erro,
      dados_parciais: { nome_enriquecido: nome || oem, descricao_tecnica: `${nome || 'Produto'} - OEM: ${oem || '—'}`, aplicacao_veicular: aplicacao || '—', reino: 'MINERAL', ncm_sugerido: ncm || '87089900', confianca_enriquecimento: 0.3 }
    };
  }

  const c = resultado.cruzamento;
  const aplicacaoFormatada = Array.isArray(c.aplicacao_veicular)
    ? c.aplicacao_veicular.map(v => `${v.montadora} ${v.modelo} (${v.anos})`).join(' / ')
    : (c.aplicacao_veicular || aplicacao || '—');

  const dados = {
    nome_enriquecido: c.nome_peca,
    descricao_tecnica: c.descricao_tecnica,
    descricao_curta: (`${c.nome_peca} - ${c.codigo_original_montadora || oem}`).substring(0, 160),
    aplicacao_veicular: aplicacaoFormatada,
    reino: 'MINERAL',
    sistema_veiculo: c.sistemas_veiculo,
    material_composicao: c.material_composicao,
    ncm_sugerido: c.ncm || ncm || '87089900',
    peso_estimado_kg: c.dimensoes?.peso_kg || 0,
    tags_seo: c.tags_google_shopping || [],
    garantia_cdc: c.garantia_cdc,
    confianca_enriquecimento: c.nivel_confianca || 0.7,
    cruzamento: {
      codigo_original_montadora: c.codigo_original_montadora,
      codigos_equivalentes: c.codigos_equivalentes || [],
      ean_codigos: c.ean_codigos || [],
      dimensoes: c.dimensoes,
      tipo_codigo: c.tipo_codigo,
      fontes: resultado.fontes_reais
    }
  };

  return { ok: true, dados, modelo_usado: MODEL, fonte_real: resultado.dados_reais, enriquecido_em: new Date().toISOString() };
}

async function gerarTituloSEO(produto) {
  const prompt = `Gere UM ÚNICO título SEO para Google Shopping de autopeças.
Formato: [Nome Peça] [Marca] [Código OEM] [Aplicação Veicular Principal]
Máximo: 150 caracteres. Inclua o código OEM para reduzir CPC.
Produto: ${produto.nome || ''} | OEM: ${produto.oem || ''} | Aplicação: ${produto.aplicacao || ''}
Responda APENAS o título, sem aspas, sem explicação.`;
  try {
    const titulo = await chamarGemini(prompt, 150);
    return { ok: true, titulo: titulo.replace(/['"]/g, '').trim() };
  } catch (err) { return { ok: false, titulo: produto.nome, erro: err.message }; }
}

async function validarImagem(base64Image, nomeProduto) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.length < 10) return { ok: false, erro: 'ANTHROPIC_API_KEY não configurada', confianca: 0 };
  try {
    const resp = await axios.post(ANTHROPIC_URL,
      { model: MODEL, max_tokens: 50, messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64Image } },
        { type: 'text', text: `Esta imagem mostra um(a) "${nomeProduto}"? Responda APENAS: SIM ou NÃO, vírgula e número 0-100. Ex: SIM, 92` }
      ]}] },
      { headers: { ...CLAUDE_HEADERS, 'x-api-key': apiKey } }
    );
    const texto = resp.data?.content?.[0]?.text || 'NÃO, 0';
    const [dec, conf] = texto.split(',');
    const decisao = dec.trim().toUpperCase();
    const confianca = parseInt(conf?.trim() || 0);
    return { ok: true, valida: decisao === 'SIM' && confianca >= 85, decisao, confianca, aprovada: confianca >= 85 };
  } catch (err) { return { ok: false, erro: err.message, confianca: 0 }; }
}

async function enriquecerLote(produtos, delayMs = 800) {
  const resultados = [];
  for (let i = 0; i < produtos.length; i++) {
    const p = produtos[i];
    console.log(`[MOTOR] Cruzando ${i + 1}/${produtos.length}: ${p.oem || p.nome}`);
    resultados.push({ ...p, enriquecimento: await enriquecerProduto(p) });
    if (i < produtos.length - 1) await new Promise(r => setTimeout(r, delayMs));
  }
  return resultados;
}

module.exports = { enriquecerProduto, gerarTituloSEO, validarImagem, enriquecerLote, chamarGemini, cruzarCodigos };
