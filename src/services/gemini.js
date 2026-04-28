// ============================================================
// GENESIS iROLLO v3.0 â GEMINI FLASH SERVICE
// Enriquecimento real de dados de autopeÃ§as
// ============================================================
const axios = require('axios');
require('dotenv').config();

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

// ------------------------------------------------------------
// CHAMADA GEMINI
// ------------------------------------------------------------
async function chamarGemini(prompt, maxTokens = 1000) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'SUA_GEMINI_API_KEY_AQUI') {
    throw new Error('GEMINI_API_KEY nÃ£o configurada no .env');
  }

  const resp = await axios.post(
    `${GEMINI_URL}/${MODEL}:generateContent?key=${apiKey}`,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.1 // Baixo para dados tÃ©cnicos precisos
      }
    }
  );

  const texto = resp.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return texto.trim();
}

// ------------------------------------------------------------
// ENRIQUECER PRODUTO (retorna JSON com dados tÃ©cnicos)
// ------------------------------------------------------------
async function enriquecerProduto(dadosBrutos) {
  const { oem, nome, ncm, sku, aplicacao } = dadosBrutos;

  const prompt = `VocÃª Ã© um especialista tÃ©cnico em autopeÃ§as automotivas brasileiras.
Analise o produto abaixo e retorne APENAS um JSON vÃ¡lido (sem markdown, sem explicaÃ§Ãµes).

PRODUTO:
- Nome bruto: ${nome || 'nÃ£o informado'}
- CÃ³digo OEM/MPN: ${oem || 'nÃ£o informado'}
- NCM: ${ncm || 'nÃ£o informado'}
- SKU: ${sku || 'nÃ£o informado'}
- AplicaÃ§Ã£o: ${aplicacao || 'nÃ£o informada'}

Retorne JSON com este formato exato:
{
  "nome_enriquecido": "Nome completo tÃ©cnico em Full-Match: [PeÃ§a] + [Material] + [Marca] + [OEM] + [AplicaÃ§Ã£o veicular]",
  "descricao_tecnica": "DescriÃ§Ã£o tÃ©cnica detalhada de 3-5 frases para Google Shopping e SEO, incluindo material, funÃ§Ã£o, compatibilidade e dados de instalaÃ§Ã£o",
  "descricao_curta": "MÃ¡x 160 caracteres para meta description",
  "aplicacao_veicular": "Lista de veÃ­culos compatÃ­veis com ano, ex: Honda Civic (2001-2006) / Toyota Corolla (2003-2008)",
  "reino": "MINERAL | VEGETAL_SINTETICO | ELETRO_NEURAL",
  "sistema_veiculo": "Motor | Freios | SuspensÃ£o | Arrefecimento | TransmissÃ£o | ElÃ©trica | etc",
  "material_composicao": "AÃ§o carbono | AlumÃ­nio fundido | Borracha EPDM | etc",
  "ncm_sugerido": "NCM de 8 dÃ­gitos mais provÃ¡vel para este produto",
  "peso_estimado_kg": 0.0,
  "tags_seo": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "garantia_cdc": "Texto de garantia conforme CDC Art.8 Art.31 baseado no material do produto",
  "confianca_enriquecimento": 0.0
}

IMPORTANTE: Responda SOMENTE o JSON. Nenhum texto antes ou depois.`;

  try {
    const resposta = await chamarGemini(prompt, 1500);

    // Remove possÃ­veis markdown fences
    const jsonLimpo = resposta.replace(/```json|```/g, '').trim();
    const dados = JSON.parse(jsonLimpo);

    return {
      ok: true,
      dados,
      modelo_usado: MODEL,
      enriquecido_em: new Date().toISOString()
    };

  } catch (err) {
    console.error('[GEMINI] Erro:', err.message);
    return {
      ok: false,
      erro: err.message,
      dados_parciais: {
        nome_enriquecido: nome,
        descricao_tecnica: `${nome || 'Produto'} - OEM: ${oem || 'â'}`,
        aplicacao_veicular: aplicacao || 'â',
        reino: 'MINERAL',
        ncm_sugerido: ncm || '87089900',
        confianca_enriquecimento: 0.5
      }
    };
  }
}

// ------------------------------------------------------------
// GERAR TÃTULO SEO FULL-MATCH
// ------------------------------------------------------------
async function gerarTituloSEO(produto) {
  const prompt = `Gere UM ÃNICO tÃ­tulo SEO para Google Shopping de autopeÃ§as.
Formato: [Nome da PeÃ§a] [Material/Tipo] [Marca] [CÃ³digo OEM] [AplicaÃ§Ã£o Veicular]
MÃ¡ximo: 150 caracteres.
Produto: ${produto.nome || ''} | OEM: ${produto.oem || ''} | AplicaÃ§Ã£o: ${produto.aplicacao || ''}
Responda APENAS o tÃ­tulo, sem aspas, sem explicaÃ§Ã£o.`;

  try {
    const titulo = await chamarGemini(prompt, 100);
    return { ok: true, titulo: titulo.replace(/['"]/g, '').trim() };
  } catch (err) {
    return { ok: false, titulo: produto.nome, erro: err.message };
  }
}

// ------------------------------------------------------------
// VALIDAR IMAGEM com visÃ£o (se vier base64)
// ------------------------------------------------------------
async function validarImagem(base64Image, nomeProduto) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'SUA_GEMINI_API_KEY_AQUI') {
    return { ok: false, erro: 'API Key nÃ£o configurada', confianca: 0 };
  }

  try {
    const resp = await axios.post(
      `${GEMINI_URL}/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        contents: [{
          parts: [
            { text: `Esta imagem mostra um(a) "${nomeProduto}"? Responda APENAS: SIM ou NÃO, seguido de vÃ­rgula e um nÃºmero de 0 a 100 representando a confianÃ§a. Ex: SIM, 92` },
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } }
          ]
        }]
      }
    );

    const texto = resp.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'NÃO, 0';
    const partes = texto.split(',');
    const decisao = partes[0].trim().toUpperCase();
    const confianca = parseInt(partes[1]?.trim() || 0);

    return {
      ok: true,
      valida: decisao === 'SIM' && confianca >= 85,
      decisao,
      confianca,
      aprovada: confianca >= 85
    };

  } catch (err) {
    return { ok: false, erro: err.message, confianca: 0 };
  }
}

// ------------------------------------------------------------
// ENRIQUECIMENTO EM MASSA (lote)
// ------------------------------------------------------------
async function enriquecerLote(produtos, delayMs = 500) {
  const resultados = [];

  for (let i = 0; i < produtos.length; i++) {
    const p = produtos[i];
    console.log(`[GEMINI] Enriquecendo ${i + 1}/${produtos.length}: ${p.oem || p.nome}`);

    const resultado = await enriquecerProduto(p);
    resultados.push({ ...p, enriquecimento: resultado });

    // Delay entre chamadas para evitar rate limit
    if (i < produtos.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return resultados;
}

module.exports = {
  enriquecerProduto,
  gerarTituloSEO,
  validarImagem,
  enriquecerLote,
  chamarGemini
};
// ============================================================
// GENESIS iROLLO v3.0 — GEMINI FLASH SERVICE
// Enriquecimento real de dados de autopeças
// ============================================================
const axios = require('axios');
require('dotenv').config();

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

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
        temperature: 0.1 // Baixo para dados técnicos precisos
      }
    }
  );

  const texto = resp.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return texto.trim();
}

// ------------------------------------------------------------
// ENRIQUECER PRODUTO (retorna JSON com dados técnicos)
