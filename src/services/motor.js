// ============================================================
// GENESIS iROLLO v3.5 — MOTOR NCT HONESTO
// NCT = (TF×0.50) + (FM×0.20) + (CO×0.20) + (AV×0.10)
// TF penalizado pela confiança da IA — não mente nunca
// USA crypto NATIVO do Node.js — sem dependências externas
// ============================================================
const crypto = require('crypto');

// ------------------------------------------------------------
// RAST-HASH: md5(SKU + OEM + empresa)[:16].upper()
// ------------------------------------------------------------
function gerarRastHash(sku, oem, empresa = 'MOBIS') {
  if (!sku && !oem) return null;
  const input = (sku || '') + (oem || '') + empresa;
  return crypto.createHash('md5').update(input).digest('hex').toUpperCase().substring(0, 16);
}

// ------------------------------------------------------------
// CALCULAR NCT — Motor Honesto iRollo v3.5
// Regras de Engenharia de Informação:
//   TF real = triangulação confirmada em fontes externas
//   TF sem dados reais = penalizado pela confiança da IA
//   FM = nome enriquecido com palavras técnicas reais
//   CO = NCM validado com 8 dígitos
//   AV = aplicação veicular confirmada
// ------------------------------------------------------------
function calcularNCT(produto) {
  const {
    oem, ncm, sku, nome, aplicacao, ean, peso_bruto, largura,
    confianca_ia, dados_reais, codigos_equivalentes_count
  } = produto;

  // === TF — Triangulação OEM (peso 50%) ===
  // Sem dados reais da web: TF é limitado pela confiança da IA
  // Com dados reais: TF reflete a qualidade do código OEM + equivalentes
  let tf = 0;
  if (oem && oem.replace(/\s/g,'').length >= 4) {
    // Base pelo tamanho e formato do código OEM
    const oemBase = Math.min(0.60 + (oem.replace(/\s/g,'').length * 0.02), 0.85);

    if (dados_reais) {
      // Dados confirmados na web — TF alto
      tf = oemBase;
      // Bônus por equivalentes encontrados
      const eqCount = codigos_equivalentes_count || 0;
      if (eqCount >= 3) tf = Math.min(tf + 0.15, 1.0);
      else if (eqCount >= 1) tf = Math.min(tf + 0.08, 1.0);
    } else {
      // Sem dados reais: TF limitado pela confiança da IA
      // Confiança 0.9 → TF até oemBase | Confiança 0.1 → TF até 0.15
      const confianca = typeof confianca_ia === 'number' ? confianca_ia : 0.5;
      tf = oemBase * confianca;
    }
  } else if (oem && oem.length > 0) {
    const confianca = typeof confianca_ia === 'number' ? confianca_ia : 0.5;
    tf = 0.30 * confianca;
  }

  // === FM — Full-Match nome técnico (peso 20%) ===
  // Nome precisa ser técnico, não apenas o código OEM repetido
  let fm = 0;
  if (nome) {
    const palavras = nome.trim().split(/\s+/).length;
    const ehSoOEM = oem && nome.toUpperCase().replace(/\s/g,'') === oem.toUpperCase().replace(/\s/g,'');
    if (ehSoOEM) {
      fm = 0; // Nome = OEM repetido: FM zero (não agrega informação)
    } else if (palavras >= 5) {
      fm = Math.min(0.75 + palavras * 0.02, 1.0);
    } else if (palavras >= 3) {
      fm = 0.70;
    } else if (palavras >= 2) {
      fm = 0.50;
    } else {
      fm = 0.30;
    }
    // Penaliza se confiança da IA for baixa
    if (!dados_reais && typeof confianca_ia === 'number' && confianca_ia < 0.6) {
      fm = fm * confianca_ia;
    }
  }

  // === CO — Coerência NCM (peso 20%) ===
  let co = 0;
  if (ncm) {
    const ncmLimpo = ncm.replace(/\D/g, '');
    if (ncmLimpo.length === 8) {
      co = dados_reais ? 1.0 : 0.80; // NCM com dados reais = plena confiança
    } else if (ncmLimpo.length >= 4) {
      co = 0.50;
    } else if (ncmLimpo.length > 0) {
      co = 0.20;
    }
  }

  // === AV — Aplicação Veicular (peso 10%) ===
  let av = 0;
  if (aplicacao && typeof aplicacao === 'string' && aplicacao.length > 8) {
    av = dados_reais
      ? Math.min(0.85 + aplicacao.length * 0.003, 1.0)
      : Math.min(0.60 + aplicacao.length * 0.002, 0.80);
  } else if (aplicacao && aplicacao.length > 3) {
    av = dados_reais ? 0.65 : 0.45;
  }

  // === Bônus por dados verificados ===
  let bonus = 0;
  if (ean && ean.replace(/\D/g, '').length >= 8) bonus += 0.02;
  if (peso_bruto && parseFloat(peso_bruto) > 0) bonus += 0.01;
  if (dados_reais) bonus += 0.02; // Bônus por triangulação real confirmada

  const nct = Math.min((tf * 0.50) + (fm * 0.20) + (co * 0.20) + (av * 0.10) + bonus, 1.0);

  let decisao, cor;
  if (nct >= 0.90)      { decisao = 'APROVADO';  cor = 'green';  }
  else if (nct >= 0.60) { decisao = 'PENDENTE';  cor = 'yellow'; }
  else                  { decisao = 'BLOQUEADO'; cor = 'red';    }

  // Log de auditoria — mostra exatamente como foi calculado
  console.log('[NCT] ' + (produto.oem||'?') +
    ' → TF:' + tf.toFixed(3) + ' FM:' + fm.toFixed(3) +
    ' CO:' + co.toFixed(3) + ' AV:' + av.toFixed(3) +
    ' bonus:' + bonus.toFixed(3) + ' = NCT:' + nct.toFixed(4) +
    ' | dados_reais:' + dados_reais + ' confianca:' + (confianca_ia||'N/A'));

  return {
    nct: parseFloat(nct.toFixed(4)),
    decisao, cor,
    componentes: {
      tf:    parseFloat(tf.toFixed(4)),
      fm:    parseFloat(fm.toFixed(4)),
      co:    parseFloat(co.toFixed(4)),
      av:    parseFloat(av.toFixed(4)),
      bonus: parseFloat(bonus.toFixed(4))
    },
    rast_hash: gerarRastHash(sku, oem),
    aprovado: nct >= 0.90
  };
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
  return {
    ...dadosBrutos,
    nome_completo: gerarTituloFullMatch(dadosBrutos),
    reino: detectarReino(dadosBrutos),
    nct: nctResult.nct,
    decisao: nctResult.decisao,
    rast_hash: nctResult.rast_hash,
    nct_componentes: nctResult.componentes,
    ncm_valido: validarNCM(dadosBrutos.ncm).valido,
    aprovado: nctResult.aprovado,
    processado_em: new Date().toISOString(),
    motor_versao: 'iRollo-v3.5'
  };
}

module.exports = { calcularNCT, gerarRastHash, gerarTituloFullMatch, detectarReino, validarNCM, processarProduto };
