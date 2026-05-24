// ============================================================
// GENESIS iROLLO v3.1 — SISTEMA DE IMAGENS
// 6 imagens por produto — Google Shopping Quality Score
// ============================================================
const axios = require('axios');
require('dotenv').config();

const REGRAS_IMAGEM = { resolucao_minima: 1000, resolucao_ideal: 1500, fundo_branco: true, formato_aceito: ['jpg','jpeg','png','webp'], confianca_minima: 82, max_imagens_produto: 6 };

const SLOTS = [
  { id: 1, angulo: 'PRINCIPAL',   instrucao: 'Frontal fundo branco — imagem principal' },
  { id: 2, angulo: 'LATERAL 90°', instrucao: 'Vista lateral — dimensões' },
  { id: 3, angulo: 'DETALHE',     instrucao: 'Close técnico — código gravado, material' },
  { id: 4, angulo: 'CONEXÃO',     instrucao: 'Cano de saída, rosca, encaixes' },
  { id: 5, angulo: 'EMBALAGEM',   instrucao: 'Caixa original com código' },
  { id: 6, angulo: 'INSTALADA',   instrucao: 'Peça instalada no veículo — P-Max' }
];

async function validarImagemIA(imageUrl, nomeProduto, oem) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes('AQUI')) return { ok: false, erro: 'GEMINI_API_KEY não configurada', confianca: 0 };
  try {
    const imgResp = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 12000, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GenesisBot/3.1)' } });
    const base64 = Buffer.from(imgResp.data).toString('base64');
    const mimeType = imgResp.headers['content-type']?.split(';')[0] || 'image/jpeg';
    if (!['image/jpeg','image/png','image/webp'].includes(mimeType)) return { ok: false, erro: 'Formato não suportado', confianca: 0 };
    const prompt = `Audite esta imagem para Google Shopping de autopeças. Responda APENAS JSON:\n{"produto_correto":true/false,"fundo_branco":true/false,"produto_real":true/false,"sem_texto":true/false,"sem_watermark":true/false,"qualidade_foto":"alta/media/baixa","confianca":0-100,"aprovada":true/false,"motivo_reprovacao":"motivo ou null"}\nProduto: ${nomeProduto} | OEM: ${oem}`;
    const geminiResp = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || 'gemini-1.5-flash'}:generateContent?key=${apiKey}`, { contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType, data: base64 } }] }], generationConfig: { maxOutputTokens: 300, temperature: 0.1 } }, { timeout: 20000 });
    const texto = geminiResp.data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const resultado = JSON.parse(texto.replace(/```json|```/g, '').trim());
    const aprovada = resultado.confianca >= REGRAS_IMAGEM.confianca_minima && resultado.produto_real && resultado.produto_correto;
    return { ok: true, url: imageUrl, ...resultado, aprovada };
  } catch (err) { return { ok: false, erro: err.message, confianca: 0, aprovada: false }; }
}

async function buscarImagensProduto(oem, marca, nomeProduto, quantidade = 6) {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_CX || '';
  const queries = [`"${oem}" "${marca}" autopeça fundo branco`, `"${oem}" ${marca} peça automotiva`, `${nomeProduto.split(' ').slice(0,5).join(' ')} fundo branco`, `${marca} ${oem} automotive part white background`];
  const resultados = [];
  if (!apiKey || apiKey.includes('AQUI') || !cx) {
    for (let i = 0; i < Math.min(queries.length, quantidade); i++) resultados.push({ url: null, query: queries[i], fonte: 'Google Images (busca manual)', precisa_validacao: true, busca_url: `https://images.google.com/search?q=${encodeURIComponent(queries[i])}&tbm=isch`, slot: SLOTS[i] || SLOTS[0] });
    return resultados;
  }
  for (let qi = 0; qi < queries.length && resultados.length < quantidade; qi++) {
    try {
      const resp = await axios.get('https://www.googleapis.com/customsearch/v1', { params: { key: apiKey, cx, q: queries[qi], searchType: 'image', imgSize: 'large', num: Math.min(3, quantidade - resultados.length) }, timeout: 10000 });
      (resp.data.items || []).forEach(item => { if (resultados.length < quantidade) resultados.push({ url: item.link, thumbnail: item.image?.thumbnailLink, fonte: item.displayLink, query: queries[qi], slot: SLOTS[resultados.length] || SLOTS[0] }); });
    } catch (err) { console.error('[IMAGENS] Erro na busca:', err.message); }
  }
  return resultados;
}

async function processarImagensProduto(oem, marca, nomeProduto, maxImagens = 6) {
  const candidatas = await buscarImagensProduto(oem, marca, nomeProduto, maxImagens * 2);
  const aprovadas = [], rejeitadas = [];
  for (const img of candidatas) {
    if (aprovadas.length >= maxImagens) break;
    if (!img.url || !img.url.startsWith('http')) { aprovadas.push({ ...img, status: 'PENDENTE_MANUAL', confianca: 0, aprovada: false }); continue; }
    const validacao = await validarImagemIA(img.url, nomeProduto, oem);
    if (validacao.aprovada) aprovadas.push({ ...img, ...validacao, status: 'APROVADA', slot: SLOTS[aprovadas.length] || SLOTS[0] });
    else rejeitadas.push({ ...img, ...validacao, status: 'REJEITADA' });
  }
  while (aprovadas.length < maxImagens) aprovadas.push({ url: null, status: 'VAZIO', slot: SLOTS[aprovadas.length] || { id: aprovadas.length + 1, angulo: `IMAGEM ${aprovadas.length + 1}`, instrucao: 'Aguardando upload manual' }, mensagem: 'Slot vazio — faça upload manualmente' });
  const totalAprovadas = aprovadas.filter(i => i.status === 'APROVADA').length;
  const qualityScore = totalAprovadas >= 4 ? 'ALTO — CPC mínimo' : totalAprovadas >= 2 ? 'BOM — CPC moderado' : totalAprovadas >= 1 ? 'MÉDIO — CPC alto' : 'BAIXO — Google penaliza';
  return { ok: totalAprovadas > 0, oem, marca, nomeProduto, galeria: aprovadas, imagem_principal: aprovadas.find(i => i.status === 'APROVADA')?.url || null, total_aprovadas: totalAprovadas, quality_score: qualityScore, flag_manual: totalAprovadas < maxImagens };
}

module.exports = { validarImagemIA, buscarImagensProduto, processarImagensProduto, REGRAS_IMAGEM, SLOTS };
