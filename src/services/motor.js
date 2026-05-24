// ============================================================
// GENESIS iROLLO v3.0 — MOTOR NCT
// NCT = (TF*0.50) + (FM*0.20) + (CO*0.20) + (AV*0.10)
// USA crypto NATIVO do Node.js — sem dependências externas
// ============================================================
const crypto = require('crypto');

function gerarRastHash(sku, oem, empresa = 'MOBIS') {
  if (!sku && !oem) return null;
  const input = (sku || '') + (oem || '') + empresa;
  return crypto.createHash('md5').update(input).digest('hex').toUpperCase().substring(0, 16);
}

function calcularNCT(produto) {
  const { oem, ncm, sku, nome, aplicacao, ean, peso_bruto, largura } = produto;
  let tf = 0;
  if (oem && oem.length >= 4) tf = Math.min(0.7 + (oem.length * 0.03), 1.0);
  else if (oem && oem.length > 0) tf = 0.5;
  let fm = 0;
  if (nome) { const palavras = nome.trim().split(/\s+/).length; if (palavras >= 5) fm = Math.min(0.75 + palavras * 0.02, 1.0); else if (palavras >= 3) fm = 0.70; else if (palavras > 0) fm = 0.50; }
  let co = 0;
  if (ncm) { const ncmLimpo = ncm.replace(/\D/g, ''); if (ncmLimpo.length === 8) co = 1.0; else if (ncmLimpo.length >= 4) co = 0.6; else if (ncmLimpo.length > 0) co = 0.3; }
  let av = 0;
  if (aplicacao && aplicacao.length > 8) av = Math.min(0.80 + aplicacao.length * 0.004, 1.0);
  else if (aplicacao && aplicacao.length > 3) av = 0.60;
  let bonus = 0;
  if (ean && ean.replace(/\D/g, '').length >= 8) bonus += 0.02;
  if (peso_bruto && parseFloat(peso_bruto) > 0) bonus += 0.01;
  if (largura && parseFloat(largura) > 0) bonus += 0.01;
  const nct = Math.min((tf * 0.50) + (fm * 0.20) + (co * 0.20) + (av * 0.10) + bonus, 1.0);
  let decisao, cor;
  if (nct >= 0.90) { decisao = 'APROVADO'; cor = 'green'; }
  else if (nct >= 0.60) { decisao = 'PENDENTE'; cor = 'yellow'; }
  else { decisao = 'BLOQUEADO'; cor = 'red'; }
  return { nct: parseFloat(nct.toFixed(4)), decisao, cor, componentes: { tf: parseFloat(tf.toFixed(4)), fm: parseFloat(fm.toFixed(4)), co: parseFloat(co.toFixed(4)), av: parseFloat(av.toFixed(4)), bonus: parseFloat(bonus.toFixed(4)) }, rast_hash: gerarRastHash(sku, oem), aprovado: nct >= 0.90 };
}

function gerarTituloFullMatch(produto) {
  const { nome, marca, oem } = produto;
  const marcaFinal = marca || process.env.MARCA_PADRAO || 'TRIMGO';
  let titulo = nome || '';
  if (marcaFinal && !titulo.toUpperCase().includes(marcaFinal.toUpperCase())) titulo = `${titulo} ${marcaFinal}`;
  if (oem && !titulo.toUpperCase().includes(oem.toUpperCase())) titulo = `${titulo} ${oem}`;
  return titulo.trim();
}

function detectarReino(produto) {
  const texto = `${produto.nome || ''} ${produto.categoria || ''}`.toLowerCase();
  const mineral = ['amortecedor','bandeja','cubo','rolamento','bucha','pino','mola','bloco','cabeçote','virabrequim','biela'];
  const vegetal = ['filtro','correia','mangueira','borracha','junta','pastilha','lona','disco','fluido'];
  const eletro = ['sensor','sonda','módulo','central','bobina','alternador','injetor','bico','vela','relé'];
  for (const p of mineral) if (texto.includes(p)) return 'MINERAL';
  for (const p of vegetal) if (texto.includes(p)) return 'VEGETAL_SINTETICO';
  for (const p of eletro) if (texto.includes(p)) return 'ELETRO_NEURAL';
  return 'MINERAL';
}

function validarNCM(ncm) {
  if (!ncm) return { valido: false, motivo: 'NCM não informado' };
  const limpo = ncm.replace(/\D/g, '');
  if (limpo.length !== 8) return { valido: false, motivo: `NCM deve ter 8 dígitos, tem ${limpo.length}` };
  return { valido: true, ncm_formatado: limpo };
}

function processarProduto(dadosBrutos) {
  const nctResult = calcularNCT(dadosBrutos);
  return { ...dadosBrutos, nome_completo: gerarTituloFullMatch(dadosBrutos), reino: detectarReino(dadosBrutos), nct: nctResult.nct, decisao: nctResult.decisao, rast_hash: nctResult.rast_hash, nct_componentes: nctResult.componentes, ncm_valido: validarNCM(dadosBrutos.ncm).valido, aprovado: nctResult.aprovado, processado_em: new Date().toISOString(), motor_versao: 'iRollo-v3.1' };
}

module.exports = { calcularNCT, gerarRastHash, gerarTituloFullMatch, detectarReino, validarNCM, processarProduto };
