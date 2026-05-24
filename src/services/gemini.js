// ============================================================
// GENESIS iROLLO v3.0 — GEMINI FLASH SERVICE
// Enriquecimento real de dados de autopeças
// ============================================================
const axios = require('axios');
require('dotenv').config();

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

// ------------------------------------------------------------
// CHAMADA GEMINI
// ------------------------------------------------------------
async function chamarGemini(prompt, maxTokens = 1000) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'SUA_GEMINI_API_KEY_AQUI') {
    throw new Error('GEMINI_API_KEY não configurada no .env');
  }

  const resp = await axios.post(
    `${GEMINI_URL}/${MODEL}:generateContent?key=${apiKey}`,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.1
      }
    }
  );

  const texto = resp.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return texto.trim();
}

// ------------------------------------------------------------
// BUSCA REAL — Google Search API (triangulação antes do Gemini)
// ------------------------------------------------------------
async function buscarDadosReaisOEM(oem, nome) {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx     = process.env.GOOGLE_SEARCH_CX;

  if (!apiKey || !cx || apiKey === 'SUA_GOOGLE_SEARCH_API_KEY') {
    return null;
  }

  try {
    const query = encodeURIComponent(
      `"${oem}" autopeça site:mercadolivre.com.br OR site:pecamania.com.br OR site:autopecasonline.com.br OR site:magazineluiza.com.br`
    );
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${query}&num=3&hl=pt-BR`;

    const resp = await axios.get(url, { timeout: 5000 });
    const items = resp.data?.items || [];

    if (items.length === 0) return null;

    const trechos = items.map(item =>
      `Fonte: ${item.displayLink}\nTítulo: ${item.title}\nSnippet: ${item.snippet}`
    ).join('\n---\n');

    return trechos;
  } catch (err) {
    console.warn('[GOOGLE SEARCH] Erro na busca:', err.message);
    return null;
  }
}

// ------------------------------------------------------------
// ENRIQUECER PRODUTO (retorna JSON com dados técnicos)
// ------------------------------------------------------------
async function enriquecerProduto(dadosBrutos) {
  const { oem, nome, ncm, sku, aplicacao } = dadosBrutos;

  const dadosReaisWeb = await buscarDadosReaisOEM(oem, nome);
  const secaoReal = dadosReaisWeb
    ? `\nDADOS REAIS ENCONTRADOS NA WEB (use estes como base — não invente):\n${dadosReaisWeb}\n`
    : '\n(Nenhum dado real encontrado na web — use seu conhecimento com confiança baixa)\n';

  const prompt = `Você é um especialista técnico em autopeças automotivas brasileiras.
Analise o produto abaixo e retorne APENAS um JSON válido (sem markdown, sem explicações).
IMPORTANTE: Use os dados reais da web como fonte primária. Só use conhecimento próprio se não houver dados reais.
${secaoReal}
PRODUTO:
- Nome bruto: ${nome || 'não informado'}
- Código OEM/MPN: ${oem || 'não informado'}
- NCM: ${ncm || 'não informado'}
- SKU: ${sku || 'não informado'}
- Aplicação: ${aplicacao || 'não informada'}

Retorne JSON com este formato exato:
{
  "nome_enriquecido": "Nome completo técnico em Full-Match",
  "descricao_tecnica": "Descrição técnica detalhada de 3-5 frases para Google Shopping e SEO",
  "descricao_curta": "Máx 160 caracteres para meta description",
  "aplicacao_veicular": "Lista de veículos compatíveis com ano",
  "reino": "MINERAL | VEGETAL_SINTETICO | ELETRO_NEURAL",
  "sistema_veiculo": "Motor | Freios | Suspensão | Arrefecimento | Transmissão | Elétrica | etc",
  "material_composicao": "Material principal",
  "ncm_sugerido": "NCM de 8 dígitos",
  "peso_estimado_kg": 0.0,
  "tags_seo": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "garantia_cdc": "Texto de garantia conforme CDC Art.8 Art.31",
  "confianca_enriquecimento": 0.0
}

IMPORTANTE: Responda SOMENTE o JSON. Nenhum texto antes ou depois.`;

  try {
    const resposta = await chamarGemini(prompt, 1500);
    const jsonLimpo = resposta.replace(/```json|```/g, '').trim();
    const dados = JSON.parse(jsonLimpo);

    return {
      ok: true,
      dados,
      modelo_usado: MODEL,
      fonte_real: !!dadosReaisWeb,
      enriquecido_em: new Date().toISOString()
    };

  } catch (err) {
    console.error('[GEMINI] Erro:', err.message);
    return {
      ok: false,
      erro: err.message,
      dados_parciais: {
        nome_enriquecido: nome,
        descricao_tecnica: `${nome || 'Produto'} - OEM: ${oem || '—'}`,
        aplicacao_veicular: aplicacao || '—',
        reino: 'MINERAL',
        ncm_sugerido: ncm || '87089900',
        confianca_enriquecimento: 0.5
      }
    };
  }
}

async function gerarTituloSEO(produto) {
  const prompt = `Gere UM ÚNICO título SEO para Google Shopping de autopeças.
Formato: [Nome da Peça] [Material/Tipo] [Marca] [Código OEM] [Aplicação Veicular]
Máximo: 150 caracteres.
Produto: ${produto.nome || ''} | OEM: ${produto.oem || ''} | Aplicação: ${produto.aplicacao || ''}
Responda APENAS o título, sem aspas, sem explicação.`;

  try {
    const titulo = await chamarGemini(prompt, 100);
    return { ok: true, titulo: titulo.replace(/['"]/g, '').trim() };
  } catch (err) {
    return { ok: false, titulo: produto.nome, erro: err.message };
  }
}

async function validarImagem(base64Image, nomeProduto) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'SUA_GEMINI_API_KEY_AQUI') {
    return { ok: false, erro: 'API Key não configurada', confianca: 0 };
  }
  try {
    const resp = await axios.post(
      `${GEMINI_URL}/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        contents: [{
          parts: [
            { text: `Esta imagem mostra um(a) "${nomeProduto}"? Responda APENAS: SIM ou NÃO, seguido de vírgula e um número de 0 a 100. Ex: SIM, 92` },
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } }
          ]
        }]
      }
    );
    const texto = resp.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'NÃO, 0';
    const partes = texto.split(',');
    const decisao = partes[0].trim().toUpperCase();
    const confianca = parseInt(partes[1]?.trim() || 0);
    return { ok: true, valida: decisao === 'SIM' && confianca >= 85, decisao, confianca, aprovada: confianca >= 85 };
  } catch (err) {
    return { ok: false, erro: err.message, confianca: 0 };
  }
}

async function enriquecerLote(produtos, delayMs = 500) {
  const resultados = [];
  for (let i = 0; i < produtos.length; i++) {
    const p = produtos[i];
    console.log(`[GEMINI] Enriquecendo ${i + 1}/${produtos.length}: ${p.oem || p.nome}`);
    const resultado = await enriquecerProduto(p);
    resultados.push({ ...p, enriquecimento: resultado });
    if (i < produtos.length - 1) await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  return resultados;
}

module.exports = { enriquecerProduto, gerarTituloSEO, validarImagem, enriquecerLote, chamarGemini };
