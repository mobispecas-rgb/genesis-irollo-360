// ============================================================
// GENESIS iROLLO — SKILLS & PLAYBOOKS DA IA v1.0
// Ensina o agente como agir em cada situacao do projeto
// ============================================================
const { chamarGemini } = require('../services/gemini');

async function _json(prompt, maxTok) {
  const r = await chamarGemini(prompt, maxTok);
  return JSON.parse(r.replace(/```json|```/g,'').trim());
}

// SKILL 1 — Classificar produto
async function classificarProduto(texto) {
  try {
    const d = await _json('Classifique este produto de autopeca: "'+texto+'" Retorne JSON: {"categoria":"Motor|Freios|Suspensao|Eletrica|Carroceria|Arrefecimento|Transmissao|Filtros|Ignicao|Outro","subcategoria":"ex: Filtro de Oleo","marca_veiculo":"Genesis|Hyundai|Kia|Universal|Outro","urgencia_reposicao":"Alta|Media|Baixa","tipo_peca":"Original|Paralela|Remanufaturada|Desconhecido","perigoso_transporte":false,"liquido":false,"confianca":0.0} Responda SOMENTE JSON.', 300);
    return { ok:true, dados:d };
  } catch(e) { return { ok:false, erro:e.message }; }
}

// SKILL 2 — Responder duvida do logista
async function responderLogista(pergunta, ctx='') {
  try {
    const r = await chamarGemini('Voce e o assistente tecnico Genesis iRollo para logistas da MOBIS Autopecas. Responda de forma direta e pratica. '+(ctx?'PRODUTO: '+ctx+' ':'')+'PERGUNTA: "'+pergunta+'" Maximo 3 paragrafos curtos.', 400);
    return { ok:true, resposta:r };
  } catch(e) { return { ok:false, erro:e.message }; }
}

// SKILL 3 — Detectar anomalia em pedido
async function detectarAnomalia(pedido) {
  try {
    const d = await _json('Analise este pedido de autopeca e detecte anomalias: '+JSON.stringify(pedido)+' Retorne JSON: {"tem_anomalia":false,"anomalias":[],"nivel_risco":"Alto|Medio|Baixo|Nenhum","acao_recomendada":"","pode_prosseguir":true,"confianca":0.0} Responda SOMENTE JSON.', 400);
    return { ok:true, dados:d };
  } catch(e) { return { ok:false, erro:e.message }; }
}

// SKILL 4 — Sugerir NCM correto
async function sugerirNCM(nome) {
  try {
    const d = await _json('Especialista em NCM Brasil. Sugira o NCM para: "'+nome+'" Retorne JSON: {"ncm":"00000000","descricao_ncm":"","aliquota_ipi":"X%","observacao":"","confianca":0.0} Responda SOMENTE JSON.', 200);
    return { ok:true, dados:d };
  } catch(e) { return { ok:false, erro:e.message }; }
}

// SKILL 5 — Validar compatibilidade veicular
async function validarCompatibilidade(oem, veiculo) {
  try {
    const d = await _json('A peca OEM "'+oem+'" e compativel com "'+veiculo+'"? Retorne JSON: {"compativel":false,"nivel_confianca":"Confirmado|Provavel|Incerto|Incompativel","observacao":"","alternativas":[],"confianca":0.0} Responda SOMENTE JSON.', 300);
    return { ok:true, dados:d };
  } catch(e) { return { ok:false, erro:e.message }; }
}

// PLAYBOOK — Fluxo completo entrada de produto
async function playbookEntradaProduto(dados) {
  console.log('[PLAYBOOK] Entrada produto:', dados.oem||dados.nome);
  const inicio = Date.now();
  const steps = {};
  steps.classificacao = await classificarProduto(dados.nome||dados.oem||'');
  steps.anomalias     = await detectarAnomalia(dados);
  if (!dados.ncm) {
    steps.ncm = await sugerirNCM(dados.nome||dados.oem||'');
    if (steps.ncm.ok) dados.ncm_sugerido = steps.ncm.dados.ncm;
  }
  return {
    ok:true, produto:dados, playbook:'entrada_produto',
    pode_prosseguir: steps.anomalias?.dados?.pode_prosseguir !== false,
    alerta: steps.anomalias?.dados?.tem_anomalia ? steps.anomalias.dados.acao_recomendada : null,
    steps, tempo_ms:Date.now()-inicio, executado_em:new Date().toISOString()
  };
}

// PLAYBOOK — Chat com logista
async function playbookChatLogista(msg, historico=[]) {
  const ctx = historico.slice(-3).map(h=>h.role+': '+h.content).join(' | ');
  try {
    const r = await chamarGemini('Voce e o assistente Genesis iRollo para logistas MOBIS. Conhece triangulacao NCT, equivalencias de pecas, Bling ERP, NFs, estoque, SEO. '+(ctx?'HISTORICO: '+ctx+' ':'')+'LOGISTA: "'+msg+'" Responda direto e em portugues. Max 200 palavras.', 500);
    return { ok:true, resposta:r, ts:new Date().toISOString() };
  } catch(e) { return { ok:false, erro:e.message }; }
}

module.exports = { classificarProduto, responderLogista, detectarAnomalia, sugerirNCM, validarCompatibilidade, playbookEntradaProduto, playbookChatLogista };
