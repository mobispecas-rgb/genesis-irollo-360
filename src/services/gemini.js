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
