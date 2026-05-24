// ============================================================
// GENESIS iROLLO v3.0 — GEMINI FLASH SERVICE
// ============================================================
const axios = require('axios');
require('dotenv').config();

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';

async function chamarGemini(prompt, maxTokens = 1000) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'SUA_GEMINI_API_KEY_AQUI') throw new Error('GEMINI_API_KEY não configurada');
  const resp = await axios.post(`${GEMINI_URL}/${MODEL}:generateContent?key=${apiKey}`, { contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: maxTokens, temperature: 0.1 } });
  return (resp.data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
}

async function enriquecerProduto(dadosBrutos) {
  const { oem, nome, ncm, sku, aplicacao } = dadosBrutos;
  const prompt = `Você é especialista técnico em autopeças automotivas brasileiras.
Analise e retorne APENAS JSON válido (sem markdown):

PRODUTO:
- Nome: ${nome || 'não informado'}
- OEM/MPN: ${oem || 'não informado'}
- NCM: ${ncm || 'não informado'}
- SKU: ${sku || 'não informado'}
- Aplicação: ${aplicacao || 'não informada'}

{"nome_enriquecido":"","descricao_tecnica":"","descricao_curta":"","aplicacao_veicular":"","reino":"","sistema_veiculo":"","material_composicao":"","ncm_sugerido":"","peso_estimado_kg":0,"tags_seo":[],"garantia_cdc":"","confianca_enriquecimento":0}`;
  try {
    const resposta = await chamarGemini(prompt, 1500);
    const dados = JSON.parse(resposta.replace(/```json|```/g, '').trim());
    return { ok: true, dados, modelo_usado: MODEL, enriquecido_em: new Date().toISOString() };
  } catch (err) {
    console.error('[GEMINI] Erro:', err.message);
    return { ok: false, erro: err.message, dados_parciais: { nome_enriquecido: nome, descricao_tecnica: `${nome || 'Produto'} - OEM: ${oem || '-'}`, aplicacao_veicular: aplicacao || '-', reino: 'MINERAL', ncm_sugerido: ncm || '87089900', confianca_enriquecimento: 0.5 } };
  }
}

async function gerarTituloSEO(produto) {
  const prompt = `Gere UM ÚNICO título SEO para Google Shopping de autopeças.
Formato: [Peça] [Material/Tipo] [Marca] [OEM] [Aplicação]
Máximo: 150 caracteres.
Produto: ${produto.nome || ''} | OEM: ${produto.oem || ''} | Aplicação: ${produto.aplicacao || ''}
Responda APENAS o título, sem aspas.`;
  try {
    const titulo = await chamarGemini(prompt, 100);
    return { ok: true, titulo: titulo.replace(/['"]/g, '').trim() };
  } catch (err) { return { ok: false, titulo: produto.nome, erro: err.message }; }
}

async function validarImagem(base64Image, nomeProduto) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'SUA_GEMINI_API_KEY_AQUI') return { ok: false, erro: 'API Key não configurada', confianca: 0 };
  try {
    const resp = await axios.post(`${GEMINI_URL}/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, { contents: [{ parts: [{ text: `Esta imagem mostra "${nomeProduto}"? Responda: SIM ou NÃO, seguido de vírgula e confiança 0-100. Ex: SIM, 92` }, { inlineData: { mimeType: 'image/jpeg', data: base64Image } }] }] });
    const texto = resp.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'NÃO, 0';
    const partes = texto.split(',');
    const decisao = partes[0].trim().toUpperCase();
    const confianca = parseInt(partes[1]?.trim() || 0);
    return { ok: true, valida: decisao === 'SIM' && confianca >= 85, decisao, confianca, aprovada: confianca >= 85 };
  } catch (err) { return { ok: false, erro: err.message, confianca: 0 }; }
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
