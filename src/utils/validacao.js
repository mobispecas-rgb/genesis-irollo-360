// ============================================================
// GENESIS iROLLO v3.1 — VALIDAÇÃO CNPJ + NCM
// Algoritmo oficial Receita Federal
// ============================================================

function validarCNPJ(cnpj) {
  if (!cnpj) return { valido: false, motivo: 'CNPJ não informado' };
  const limpo = cnpj.replace(/\D/g, '');
  if (limpo.length !== 14) return { valido: false, motivo: `CNPJ deve ter 14 dígitos, recebido: ${limpo.length}` };
  if (/^(\d)\1{13}$/.test(limpo)) return { valido: false, motivo: 'CNPJ inválido — todos os dígitos são iguais' };
  const calc1 = [5,4,3,2,9,8,7,6,5,4,3,2];
  let soma1 = 0;
  for (let i = 0; i < 12; i++) soma1 += parseInt(limpo[i]) * calc1[i];
  const dig1 = soma1 % 11 < 2 ? 0 : 11 - (soma1 % 11);
  if (parseInt(limpo[12]) !== dig1) return { valido: false, motivo: 'CNPJ inválido — primeiro dígito verificador incorreto' };
  const calc2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
  let soma2 = 0;
  for (let i = 0; i < 13; i++) soma2 += parseInt(limpo[i]) * calc2[i];
  const dig2 = soma2 % 11 < 2 ? 0 : 11 - (soma2 % 11);
  if (parseInt(limpo[13]) !== dig2) return { valido: false, motivo: 'CNPJ inválido — segundo dígito verificador incorreto' };
  const formatado = `${limpo.slice(0,2)}.${limpo.slice(2,5)}.${limpo.slice(5,8)}/${limpo.slice(8,12)}-${limpo.slice(12)}`;
  return { valido: true, cnpj_limpo: limpo, cnpj_formatado: formatado, raiz: limpo.slice(0,8), filial: limpo.slice(8,12), digitos_verificadores: limpo.slice(12) };
}

const CAPITULOS_AUTOPECAS = {
  '40': 'Borracha — buchas, mangueiras, juntas',
  '70': 'Vidro — para-brisas, vidros laterais',
  '73': 'Ferro e aço — suportes, chapas, tubos',
  '83': 'Obras de metais — dobradiças, fechaduras',
  '84': 'Máquinas mecânicas — bombas, motores',
  '85': 'Máquinas elétricas — alternadores, sensores',
  '87': 'Veículos e autopeças — capítulo principal',
  '90': 'Instrumentos — sensores de precisão'
};

const NCM_COMUNS = {
  '87081000': 'Para-choques e suas partes',
  '87082900': 'Partes e acessórios de carroçaria',
  '87083000': 'Freios e servofreios; suas partes',
  '87084000': 'Caixas de velocidades',
  '87085000': 'Eixos com diferencial e suas partes',
  '87086000': 'Suspensões e suas partes (amortecedores)',
  '87087000': 'Rodas e suas partes e acessórios',
  '87088000': 'Sistemas de direção e suas partes',
  '87089100': 'Radiadores e suas partes',
  '87089200': 'Silenciosos e tubos de escape',
  '87089300': 'Embreagens e suas partes',
  '87089900': 'Outras partes e acessórios para veículos',
  '84099100': 'Partes para motores a explosão',
  '84099900': 'Outras partes de motores',
  '85122000': 'Aparelhos de iluminação e sinalização',
  '40169300': 'Juntas, gaxetas e retentores de borracha'
};

function validarNCM(ncm) {
  if (!ncm) return { valido: false, motivo: 'NCM não informado' };
  const limpo = ncm.replace(/\D/g, '');
  if (limpo.length !== 8) return { valido: false, motivo: `NCM deve ter 8 dígitos, recebido: ${limpo.length}`, sugestao: '87089900 — Outras partes e acessórios para veículos' };
  const capitulo = limpo.slice(0,2);
  const descricaoCapitulo = CAPITULOS_AUTOPECAS[capitulo] || null;
  const descricaoNCM = NCM_COMUNS[limpo] || null;
  const relevante = !!CAPITULOS_AUTOPECAS[capitulo];
  const formatado = `${limpo.slice(0,4)}.${limpo.slice(4,6)}.${limpo.slice(6,8)}`;
  return { valido: true, ncm_limpo: limpo, ncm_formatado: formatado, capitulo, descricao_capitulo: descricaoCapitulo, descricao_ncm: descricaoNCM, relevante_autopeca: relevante, alerta: !relevante ? `Capítulo ${capitulo} incomum para autopeças — confirme o NCM` : null };
}

function sanitizar(str, maxLen = 255) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/[<>{}[\]\\]/g, '').replace(/\s+/g, ' ').trim().substring(0, maxLen);
}

module.exports = { validarCNPJ, validarNCM, sanitizar, NCM_COMUNS, CAPITULOS_AUTOPECAS };
