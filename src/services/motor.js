// ============================================================
// GENESIS iROLLO v3.0 — MOTOR NCT
// NCT = (TF×0.50) + (FM×0.20) + (CO×0.20) + (AV×0.10)
// ============================================================
const md5 = require('md5');

// ------------------------------------------------------------
// RAST-HASH: md5(SKU + OEM + empresa)[:16].upper()
// ------------------------------------------------------------
function gerarRastHash(sku, oem, empresa = 'MOBIS') {
  if (!sku && !oem) return null;
  const input = (sku || '') + (oem || '') + empresa;
  return md5(input).toUpperCase().substring(0, 16);
}

// ------------------------------------------------------------
// CALCULAR NCT
// ------------------------------------------------------------
function calcularNCT(produto) {
  const { oem, ncm, sku, nome, aplicacao, ean, peso, largura } = produto;

  // TF — Triangulação / Código-Mãe (peso 50%)
  let tf = 0;
  if (oem && oem.length >= 4) {
    tf = Math.min(0.7 + (oem.length * 0.03), 1.0);
  } else if (oem && oem.length > 0) {
    tf = 0.5;
  }

  // FM — Full-Match do nome (peso 20%)
  let fm = 0;
  if (nome) {
    const palavras = nome.trim().split(/\s+/).length;
    if (palavras >= 5) fm = Math.min(0.75 + palavras * 0.02, 1.0);
    else if (palavras >= 3) fm = 0.70;
    else if (palavras > 0) fm = 0.50;
  }

  // CO — Coerência NCM (peso 20%)
  let co = 0;
  if (ncm) {
    const ncmLimpo = ncm.replace(/\D/g, '');
    if (ncmLimpo.length === 8) co = 1.0;
    else if (ncmLimpo.length >= 4) co = 0.6;
    else if (ncmLimpo.length > 0) co = 0.3;
  }

  // AV — Aplicação Veicular (peso 10%)
  let av = 0;
  if (aplicacao && aplicacao.length > 8) {
    av = Math.min(0.80 + aplicacao.length * 0.004, 1.0);
  } else if (aplicacao && aplicacao.length > 3) {
    av = 0.60;
  }

  // Bonus: EAN e Peso/Medidas aumentam confiança
  let bonus = 0;
  if (ean && ean.replace(/\D/g, '').length >= 8) bonus += 0.02;
  if (peso && parseFloat(peso) > 0) bonus += 0.01;
  if (largura && parseFloat(largura) > 0) bonus += 0.01;

  // NCT Final
  const nctBase = (tf * 0.50) + (fm * 0.20) + (co * 0.20) + (av * 0.10);
  const nct = Math.min(nctBase + bonus, 1.0);

  // Decisão
  let decisao, cor;
  if (nct >= 0.90) {
    decisao = 'APROVADO';
    cor = 'green';
  } else if (nct >= 0.60) {
    decisao = 'PENDENTE';
    cor = 'yellow';
  } else {
    decisao = 'BLOQUEADO';
    cor = 'red';
  }

  return {
    nct: parseFloat(nct.toFixed(4)),
    decisao,
    cor,
    componentes: {
      tf: parseFloat(tf.toFixed(4)),
      fm: parseFloat(fm.toFixed(4)),
      co: parseFloat(co.toFixed(4)),
      av: parseFloat(av.toFixed(4)),
      bonus: parseFloat(bonus.toFixed(4))
    },
    rast_hash: gerarRastHash(sku, oem),
    aprovado: nct >= 0.90
  };
}

// ------------------------------------------------------------
// GERAR TÍTULO FULL-MATCH (SEO)
// Fórmula: [Peça] + [Marca] + [OEM] + [Aplicação] + [NCM]
// ------------------------------------------------------------
function gerarTituloFullMatch(produto) {
  const { nome, marca, oem, aplicacao } = produto;
  const marcaFinal = marca || process.env.MARCA_PADRAO || 'TRIMGO';

  let titulo = nome || '';

  // Garante marca no título
  if (marcaFinal && !titulo.toUpperCase().includes(marcaFinal.toUpperCase())) {
    titulo = `${titulo} ${marcaFinal}`;
  }

  // Garante OEM no título
  if (oem && !titulo.toUpperCase().includes(oem.toUpperCase())) {
    titulo = `${titulo} ${oem}`;
  }

  return titulo.trim();
}

// ------------------------------------------------------------
// DETECTAR REINO (Mineral / Vegetal-Sintético / Eletro-Neural)
// ------------------------------------------------------------
function detectarReino(produto) {
  const texto = `${produto.nome || ''} ${produto.categoria || ''}`.toLowerCase();

  const mineral = ['amortecedor', 'bandeja', 'cubo', 'rolamento', 'bucha', 'pino', 'mola', 'pivô', 'bloco', 'cabeçote', 'virabrequim', 'biela'];
  const vegetal = ['filtro', 'correia', 'mangueira', 'borracha', 'junta', 'vedação', 'óleo', 'fluido', 'pastilha', 'lona', 'disco'];
  const eletro = ['sensor', 'sonda', 'módulo', 'central', 'bobina', 'alternador', 'motor de partida', 'injetor', 'bico', 'vela', 'relé', 'fusível'];

  for (const p of mineral) if (texto.includes(p)) return 'MINERAL';
  for (const p of vegetal) if (texto.includes(p)) return 'VEGETAL_SINTETICO';
  for (const p of eletro) if (texto.includes(p)) return 'ELETRO_NEURAL';

  return 'MINERAL'; // padrão para autopeças
}

// ------------------------------------------------------------
// VALIDAR NCM
// ------------------------------------------------------------
function validarNCM(ncm) {
  if (!ncm) return { valido: false, motivo: 'NCM não informado' };
  const limpo = ncm.replace(/\D/g, '');
  if (limpo.length !== 8) return { valido: false, motivo: `NCM deve ter 8 dígitos, tem ${limpo.length}` };
  return { valido: true, ncm_formatado: limpo };
}

// ------------------------------------------------------------
// PROCESSAR PRODUTO COMPLETO
// ------------------------------------------------------------
function processarProduto(dadosBrutos) {
  const nctResult = calcularNCT(dadosBrutos);
  const reino = detectarReino(dadosBrutos);
  const titulo = gerarTituloFullMatch(dadosBrutos);
  const ncmValido = validarNCM(dadosBrutos.ncm);

  return {
    ...dadosBrutos,
    nome_completo: titulo,
    reino,
    nct: nctResult.nct,
    decisao: nctResult.decisao,
    rast_hash: nctResult.rast_hash,
    nct_componentes: nctResult.componentes,
    ncm_valido: ncmValido.valido,
    aprovado: nctResult.aprovado,
    processado_em: new Date().toISOString(),
    motor_versao: 'iRollo-v3.0'
  };
}

module.exports = {
  calcularNCT,
  gerarRastHash,
  gerarTituloFullMatch,
  detectarReino,
  validarNCM,
  processarProduto
};
