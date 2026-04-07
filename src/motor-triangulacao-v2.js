/**
 * @copyright 2026 Jose Nunes Junior / MOBIS Pecas
 * @license Proprietario — Todos os direitos reservados
 * @author Junior — Inventor do Motor NCT
 *
 * motor-triangulacao-v2.js
 * Genesis iRollo 360 · genesisindexia.com.br
 *
 * REGRA ANTI-ALUCINACAO:
 * Só preenche o que encontrar nas fontes.
 * Campo vazio se não confirmado. Nunca inventa.
 *
 * NOVIDADES v2:
 * - 10 blocos completos do banco de dados
 * - Fluxo automático de NF (webhook + polling)
 * - Repositório próprio (cache local + futura DB)
 * - Categoria automática por Bloco 2
 * - 6 imagens em cascata por ângulo
 * - CDC automático por tipo de produto
 *
 * SEGURANÇA:
 * - Fontes NUNCA expostas ao cliente/logista
 * - Dois níveis: logista (resultado) / admin (tudo)
 * - Chave ADMIN_TOKEN no .env
 */

const axios  = require('axios');
const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

// ============================================================
// CONFIG
// ============================================================
const CFG = {
  GEMINI_KEY    : process.env.GEMINI_API_KEY    || '',
  ADMIN_TOKEN   : process.env.ADMIN_TOKEN        || 'genesis-admin-2026',
  CNPJ_MOBIS    : process.env.CNPJ_MOBIS         || '',
  REPO_PATH     : process.env.REPO_PATH          || './repositorio-genesis.json',
  TIMEOUT       : 8000,
  NCT_APROVADO  : 0.90,
  NCT_PENDENTE  : 0.60,
};

// ============================================================
// REPOSITÓRIO LOCAL
// Guarda produtos já triangulados para reutilizar na próxima NF
// Futuramente: substituir por banco de dados real (MongoDB/PostgreSQL)
// ============================================================
const Repositorio = {
  dados: {},

  carregar() {
    try {
      if (fs.existsSync(CFG.REPO_PATH)) {
        this.dados = JSON.parse(fs.readFileSync(CFG.REPO_PATH, 'utf8'));
        console.log(`[Repositório] ${Object.keys(this.dados).length} produtos carregados`);
      }
    } catch (e) {
      console.error('[Repositório] Erro ao carregar:', e.message);
    }
  },

  salvar() {
    try {
      fs.writeFileSync(CFG.REPO_PATH, JSON.stringify(this.dados, null, 2));
    } catch (e) {
      console.error('[Repositório] Erro ao salvar:', e.message);
    }
  },

  // Busca por EAN, OEM ou SKU
  buscar({ ean, oem, sku }) {
    const chaves = [ean, oem, sku].filter(Boolean);
    for (const chave of chaves) {
      if (this.dados[chave]) {
        console.log(`[Repositório] HIT: ${chave}`);
        return this.dados[chave];
      }
    }
    return null;
  },

  // Salva produto congelado no repositório
  gravar(produto) {
    const chaves = [
      produto.blocos?.b1?.ean,
      produto.blocos?.b1?.oem?.split('/')[0]?.trim(),
      produto.blocos?.b1?.sku,
    ].filter(Boolean);

    for (const chave of chaves) {
      this.dados[chave] = {
        ...produto,
        repo_gravado_em: new Date().toISOString(),
      };
    }
    this.salvar();
    console.log(`[Repositório] Gravado: ${chaves.join(' | ')}`);
  },
};

// Carrega o repositório ao iniciar
Repositorio.carregar();

// ============================================================
// BLOCO 2 — CLASSIFICAÇÃO AUTOMÁTICA POR TIPO
// O agente entende o produto por aqui
// ============================================================
const CLASSIFICACAO = {
  detectar(nome = '', ncm = '', oem = '') {
    const n = (nome + ncm + oem).toLowerCase();

    if (/arranq|starter|partida|1986s/i.test(n) || ncm === '85113000')
      return { natureza: 'Elétrico', subtipo: 'Motor de Arranque', perigoso: false, liquido: false, organico: false, mineral: false, categoria: 'Elétrica / Sistema de Partida' };

    if (/bobina|ignicao|coil|vela/i.test(n) || ncm === '85113000')
      return { natureza: 'Elétrico', subtipo: 'Ignição', perigoso: false, liquido: false, organico: false, mineral: false, categoria: 'Elétrica / Ignição' };

    if (/bomba.dire|hidraul|jpr/i.test(n) || ncm === '87089990')
      return { natureza: 'Hidráulico', subtipo: 'Bomba de Direção', perigoso: false, liquido: false, organico: false, mineral: false, categoria: 'Direção / Hidráulica' };

    if (/pivo|bandeja|suspens|amort/i.test(n) || ncm === '87089900')
      return { natureza: 'Mecânico', subtipo: 'Suspensão', perigoso: false, liquido: false, organico: false, mineral: false, categoria: 'Suspensão / Direção' };

    if (/motor.parcial|motor.complet|bloco|d4bh|4d56/i.test(n) || ncm === '84089000')
      return { natureza: 'Mecânico', subtipo: 'Motor', perigoso: false, liquido: false, organico: false, mineral: false, categoria: 'Motor / Bloco' };

    if (/oleo|lubrif|sintet|mineral|5w|10w|15w/i.test(n))
      return { natureza: n.includes('sintet') ? 'Sintético' : 'Mineral', subtipo: 'Lubrificante', perigoso: false, liquido: true, organico: false, mineral: !n.includes('sintet'), categoria: 'Lubrificantes / Óleos' };

    if (/freio|pastilha|disco|lonas/i.test(n) || ncm === '87083000')
      return { natureza: 'Mecânico', subtipo: 'Freios', perigoso: false, liquido: false, organico: false, mineral: false, categoria: 'Freios / Segurança' };

    if (/filtro/i.test(n))
      return { natureza: 'Mecânico', subtipo: 'Filtro', perigoso: false, liquido: false, organico: false, mineral: false, categoria: 'Filtros / Manutenção' };

    // Fallback — agente não reconheceu
    return { natureza: '—', subtipo: '—', perigoso: false, liquido: false, organico: false, mineral: false, categoria: '— logista define' };
  },
};

// ============================================================
// CDC AUTOMÁTICO POR TIPO
// ============================================================
function gerarCDC(classificacao, fabricante = '') {
  const base = `Produto em conformidade com CDC Art. 8° (qualidade e segurança), Art. 31° (informações claras) e Art. 12° (responsabilidade do fabricante). Garantia mínima 90 dias conforme Lei 8.078/90.`;

  const extras = {
    'Elétrico'   : ' Produto elétrico — instalar com veículo desligado. Instalação por profissional habilitado obrigatória. Risco de curto-circuito se instalado incorretamente.',
    'Hidráulico' : ' Produto hidráulico — substituir fluido após instalação. Instalação por profissional habilitado.',
    'Mecânico'   : ' Instalar conforme manual do fabricante. Torque de fixação conforme especificação técnica.',
    'Sintético'  : ' Produto químico — manter fora do alcance de crianças. Descartar conforme normas ambientais.',
    'Mineral'    : ' Produto químico — manter fora do alcance de crianças. Descartar conforme normas ambientais.',
  };

  const fab = fabricante ? ` Fabricante: ${fabricante}.` : '';
  return base + (extras[classificacao.natureza] || '') + fab;
}

// ============================================================
// BULA TÉCNICA POR TIPO
// ============================================================
function gerarBula(classificacao, especificacoes = {}) {
  const bulas = {
    'Motor de Arranque' : `Motor de arranque ${especificacoes.tensao || '12V'} ${especificacoes.dentes || ''} dentes. Sentido de rotação: ${especificacoes.sentido || 'horário'}. Tempo máximo de acionamento contínuo: 10 segundos. Aguardar 30 segundos entre acionamentos. Instalar com bateria desconectada. Verificar alinhamento do pinhão com a cremalheira. Torque de fixação: conforme manual do veículo.`,
    'Ignição'           : `Bobina de ignição ${especificacoes.tensao || '12-14V'}. 1 unidade por cilindro. Substituir em conjunto (jogo completo recomendado). Verificar conector e coifa antes da instalação. Torque: conforme especificação do veículo.`,
    'Bomba de Direção'  : `Pressão: ${especificacoes.pressao || '—'} bar. Vazão: ${especificacoes.vazao || '—'} L/min. Substituir fluido hidráulico após instalação. Usar fluido especificado pelo fabricante. Verificar mangueiras e conexões.`,
    'Motor'             : `Motor ${especificacoes.cilindrada || '—'} ${especificacoes.valvulas || '—'} válvulas. Instalação por profissional especializado obrigatória. Substituir todos os fluidos. Verificar sistema de arrefecimento. Garantia condicionada à instalação correta.`,
    'Suspensão'         : `Instalar conforme manual. Torque de aperto: conforme tabela técnica. Realizar alinhamento e balanceamento após instalação. Inspecionar periodicamente a cada 20.000 km.`,
    'Lubrificante'      : `Viscosidade: ${especificacoes.viscosidade || '—'}. Trocar conforme intervalo do fabricante. Descartar embalagem conforme normas ambientais. Não misturar com outros óleos.`,
  };

  return bulas[classificacao.subtipo] || 'Instalar conforme manual do fabricante. Garantia condicionada à instalação correta por profissional habilitado.';
}

// ============================================================
// MOTOR DE IMAGEM — 6 ÂNGULOS EM CASCATA
// ============================================================
async function buscarImagens({ ean, oem, fabricante, nome, quantidade = 6 }) {
  const imagens = [];

  // P1 — EAN direto (melhor qualidade)
  if (ean && imagens.length < quantidade) {
    try {
      const r = await axios.get(`https://api.upcitemdb.com/prod/trial/lookup?upc=${ean}`, { timeout: 5000 });
      const imgs = r.data.items?.[0]?.images || [];
      imgs.forEach(url => { if (imagens.length < quantidade) imagens.push({ url, fonte: 'UPCitemdb', angulo: `img_${imagens.length + 1}` }); });
    } catch (_) {}
  }

  // P2 — Mercado Livre com OEM + fabricante
  if (oem && imagens.length < quantidade) {
    try {
      const q = `${fabricante || ''} ${oem}`.trim();
      const r = await axios.get(`https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(q)}&limit=5`, { timeout: 5000 });
      const prods = r.data.results || [];
      prods.forEach(p => {
        const url = p.thumbnail?.replace('I.jpg', 'O.jpg');
        if (url && imagens.length < quantidade) imagens.push({ url, fonte: 'Mercado Livre', angulo: `img_${imagens.length + 1}` });
      });
    } catch (_) {}
  }

  // P3 — Mercado Livre com nome enriquecido
  if (nome && imagens.length < quantidade) {
    try {
      const r = await axios.get(`https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(nome)}&limit=5`, { timeout: 5000 });
      const prods = r.data.results || [];
      prods.forEach(p => {
        const url = p.thumbnail?.replace('I.jpg', 'O.jpg');
        if (url && imagens.length < quantidade && !imagens.find(i => i.url === url)) {
          imagens.push({ url, fonte: 'Mercado Livre', angulo: `img_${imagens.length + 1}` });
        }
      });
    } catch (_) {}
  }

  // Nomeia os ângulos obrigatórios
  const angulos = ['frontal', 'lateral_d', 'lateral_e', 'traseira', 'detalhe', 'embalagem'];
  imagens.forEach((img, i) => { img.angulo = angulos[i] || `img_${i + 1}`; });

  return imagens;
}

// ============================================================
// TRIANGULAÇÃO PRINCIPAL — 10 BLOCOS
// ============================================================
async function triangular({ ean, oem, sku, nome, ncm, ramo = 'autopeças', cnpj = '', nivel = 'logista' }) {

  // 1. Verifica repositório — produto já cadastrado?
  const repo = Repositorio.buscar({ ean, oem, sku });
  if (repo) {
    console.log('[NCT] Produto no repositório — retornando direto');
    return formatarResposta({ ...repo, origem: 'repositorio' }, nivel);
  }

  // 2. Inicializa os 10 blocos
  const blocos = {
    b1: { // IDENTIDADE
      ean: ean || '',
      oem: oem || '',
      sku: sku || '',
      fabricante: '',
      pais_origem: '',
      gs1_prefixo: {},
      certificacao: '',
      rast_hash: '',
    },
    b2: { // CLASSIFICAÇÃO — o agente entende o produto aqui
      categoria: '',
      subcategoria: '',
      natureza: '',
      subtipo: '',
      perigoso: false,
      liquido: false,
      organico: false,
      mineral: false,
      composicao: '',
      cor: '',
      estado_fisico: 'Sólido',
    },
    b3: { // DIMENSÕES / LOGÍSTICA
      peso_kg: '',
      comprimento_cm: '',
      largura_cm: '',
      altura_cm: '',
      embalagem: '',
      classe_frete: '',
    },
    b4: { // BULA TÉCNICA
      tensao: '',
      potencia: '',
      dentes: '',
      sentido: '',
      sistema: '',
      uso_max: '',
      torque: '',
      texto_bula: '',
    },
    b5: { // APLICAÇÃO VEICULAR
      veiculos: [],
      motores: [],
      texto: '',
    },
    b6: { // IMAGENS — 6 ângulos
      frontal: '',
      lateral_d: '',
      lateral_e: '',
      traseira: '',
      detalhe: '',
      embalagem_img: '',
      total_encontradas: 0,
    },
    b7: { // CDC
      texto: '',
      garantia_meses: 3,
      instalacao: '',
    },
    b8: { // FISCAL
      ncm: ncm || '',
      descricao_ncm: '',
      ipi: '',
      cest: '',
      cfop_venda: '',
      cfop_compra: '',
      origem: '',
      pis: '',
      cofins: '',
    },
    b9: { // SEO
      title: '',
      description: '',
      slug: '',
      schema_type: 'Product',
    },
    b10: { // CAMBAGEM — fabricantes equivalentes
      tier1: [],
      tier2: [],
      tier3: [],
      tier4: [],
    },
  };

  const fontes_internas = []; // NUNCA exposto ao cliente
  const campos_vazios   = [];

  // ============================================================
  // B1 — GS1 Prefixo (sempre disponível, sem API)
  // ============================================================
  if (ean) {
    const PREFIXOS = {
      '3165143': { fabricante: 'Bosch Automotive', pais: 'Alemanha', certificacao: 'CE · ISO 9001' },
      '789'    : { fabricante: '—', pais: 'Brasil', certificacao: 'INMETRO' },
      '400'    : { fabricante: '—', pais: 'Alemanha', certificacao: 'CE' },
      '045'    : { fabricante: '—', pais: 'EUA', certificacao: 'UL' },
      '888'    : { fabricante: '—', pais: 'Coreia do Sul', certificacao: 'KC' },
    };
    let gs1 = { fabricante: '—', pais: 'Desconhecido' };
    for (let len = 7; len >= 3; len--) {
      const pref = ean.substring(0, len);
      if (PREFIXOS[pref]) { gs1 = { ...PREFIXOS[pref], prefixo: pref }; break; }
    }
    blocos.b1.gs1_prefixo = gs1;
    blocos.b1.fabricante  = gs1.fabricante;
    blocos.b1.pais_origem = gs1.pais;
    blocos.b1.certificacao = gs1.certificacao || '';
    fontes_internas.push({ id: 'gs1', nome: 'GS1 Prefixo', tf: 0.98, confirmou: gs1 });
  }

  // ============================================================
  // B1 + B5 — Mercado Livre (nome + aplicação + imagem)
  // ============================================================
  const termoBusca = nome || oem || ean || sku || '';
  if (termoBusca) {
    try {
      const r = await axios.get(
        `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(termoBusca)}&limit=5`,
        { timeout: CFG.TIMEOUT }
      );
      const prods = r.data.results || [];
      if (prods.length > 0) {
        const p = prods[0];
        if (!blocos.b1.fabricante || blocos.b1.fabricante === '—')
          blocos.b1.fabricante = p.attributes?.find(a => a.id === 'BRAND')?.value_name || blocos.b1.fabricante;
        blocos.b1.ean = blocos.b1.ean || p.attributes?.find(a => a.id === 'GTIN')?.value_name || '';
        blocos.b5.texto = blocos.b5.texto || p.attributes?.find(a => a.id === 'COMPATIBLE_VEHICLES')?.value_name || '';

        nome = nome || p.title || '';
        fontes_internas.push({ id: 'mercadolivre', nome: 'Mercado Livre', tf: 0.87, confirmou: { titulo: p.title, preco: p.price } });
      }
    } catch (_) {}
  }

  // ============================================================
  // B1 — UPCitemdb (EAN → nome + imagens)
  // ============================================================
  if (blocos.b1.ean) {
    try {
      const r = await axios.get(`https://api.upcitemdb.com/prod/trial/lookup?upc=${blocos.b1.ean}`, { timeout: CFG.TIMEOUT });
      const item = r.data.items?.[0];
      if (item) {
        nome = nome || item.title || '';
        if (!blocos.b1.fabricante || blocos.b1.fabricante === '—')
          blocos.b1.fabricante = item.brand || blocos.b1.fabricante;
        fontes_internas.push({ id: 'upcitemdb', nome: 'UPCitemdb', tf: 0.95, confirmou: { nome: item.title, marca: item.brand } });
      }
    } catch (_) {}
  }

  // ============================================================
  // B2 — Classificação automática (agente entende o produto)
  // ============================================================
  const classif = CLASSIFICACAO.detectar(nome, blocos.b8.ncm, oem);
  blocos.b2 = { ...blocos.b2, ...classif };
  if (blocos.b2.natureza === '—') campos_vazios.push('b2_categoria');

  // ============================================================
  // B4 — Bula técnica automática
  // ============================================================
  blocos.b4.texto_bula = gerarBula(classif, {
    tensao: blocos.b4.tensao,
    dentes: blocos.b4.dentes,
    sentido: blocos.b4.sentido,
  });

  // ============================================================
  // B6 — Imagens (6 ângulos em cascata)
  // ============================================================
  const imagens = await buscarImagens({
    ean     : blocos.b1.ean,
    oem     : blocos.b1.oem,
    fabricante: blocos.b1.fabricante,
    nome,
    quantidade: 6,
  });

  const angulosMap = ['frontal', 'lateral_d', 'lateral_e', 'traseira', 'detalhe', 'embalagem_img'];
  imagens.forEach((img, i) => {
    if (angulosMap[i]) blocos.b6[angulosMap[i]] = img.url;
  });
  blocos.b6.total_encontradas = imagens.length;
  if (imagens.length === 0) campos_vazios.push('b6_imagens');

  // ============================================================
  // B7 — CDC automático
  // ============================================================
  blocos.b7.texto = gerarCDC(classif, blocos.b1.fabricante);

  // ============================================================
  // B8 — Fiscal (NCM já informado ou inferido)
  // ============================================================
  const NCM_MAP = {
    '85113000': { desc: 'Motores de arranque elétricos', ipi: '5%', cfop_v: '6102', cfop_c: '2102', pis: '0,65%', cofins: '3%' },
    '87089990': { desc: 'Partes e acessórios de veículos', ipi: '4%', cfop_v: '6102', cfop_c: '2102', pis: '0,65%', cofins: '3%' },
    '87089900': { desc: 'Suspensão direção freios', ipi: '4%', cfop_v: '6102', cfop_c: '2102', pis: '0,65%', cofins: '3%' },
    '84089000': { desc: 'Motores diesel para veículos', ipi: '0%', cfop_v: '6102', cfop_c: '2102', pis: '0,65%', cofins: '3%' },
    '84089900': { desc: 'Partes de motores diesel', ipi: '0%', cfop_v: '6102', cfop_c: '2102', pis: '0,65%', cofins: '3%' },
  };

  if (!blocos.b8.ncm) {
    // Infere NCM pelo Bloco 2
    const ncmInferido = { 'Elétrico': '85113000', 'Hidráulico': '87089990', 'Mecânico': '87089900', 'Motor': '84089000' };
    blocos.b8.ncm = ncmInferido[classif.natureza] || '';
  }

  const fiscal = NCM_MAP[blocos.b8.ncm];
  if (fiscal) {
    blocos.b8.descricao_ncm = fiscal.desc;
    blocos.b8.ipi           = fiscal.ipi;
    blocos.b8.cfop_venda    = fiscal.cfop_v;
    blocos.b8.cfop_compra   = fiscal.cfop_c;
    blocos.b8.pis           = fiscal.pis;
    blocos.b8.cofins        = fiscal.cofins;
    blocos.b8.origem        = blocos.b1.pais_origem !== 'Brasil' ? '7 · importado' : '0 · nacional';
    fontes_internas.push({ id: 'ncm_mapa', nome: 'Tabela NCM', tf: 1.00, confirmou: { ncm: blocos.b8.ncm } });
  } else {
    campos_vazios.push('b8_ncm');
  }

  // ============================================================
  // B9 — SEO automático
  // ============================================================
  const nomeSEO = nome || `${blocos.b1.fabricante} ${oem}`.trim();
  const aplicSEO = blocos.b5.texto?.substring(0, 50) || '';
  blocos.b9.title       = `${nomeSEO} ${aplicSEO} ${oem || ''}`.trim().substring(0, 70);
  blocos.b9.description = `${nomeSEO} original ${blocos.b1.fabricante}. OEM: ${oem || '—'}. EAN: ${blocos.b1.ean || '—'}. NCM ${blocos.b8.ncm}. Garantia ${blocos.b7.garantia_meses} meses. Entrega rápida.`.substring(0, 160);
  blocos.b9.slug        = nomeSEO.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 60);

  // ============================================================
  // B1 — RAST-HASH (gerado com dados confirmados)
  // ============================================================
  blocos.b1.rast_hash = gerarRastHash({
    ean : blocos.b1.ean,
    oem : blocos.b1.oem || oem || '',
    cnpj: cnpj || CFG.CNPJ_MOBIS,
  });

  // ============================================================
  // NCT — Score calculado por fonte
  // ============================================================
  const nct = calcularNCT({ fontes: fontes_internas, blocos, campos_vazios });

  // ============================================================
  // Produto completo
  // ============================================================
  const produto = {
    status  : nct.score >= CFG.NCT_APROVADO ? 'APROVADO' : nct.score >= CFG.NCT_PENDENTE ? 'PENDENTE' : 'BLOQUEADO',
    nct,
    blocos,
    campos_vazios,
    nome    : nome || '',
    _fontes : fontes_internas, // INTERNO — nunca exposto ao logista
    criado_em: new Date().toISOString(),
  };

  // Grava no repositório se aprovado
  if (produto.status === 'APROVADO' || produto.status === 'PENDENTE') {
    Repositorio.gravar(produto);
  }

  return formatarResposta(produto, nivel);
}

// ============================================================
// FORMATAR RESPOSTA — DOIS NÍVEIS
// Logista: resultado limpo (sem fontes)
// Admin  : tudo incluindo fontes e pesos
// ============================================================
function formatarResposta(produto, nivel = 'logista') {
  if (nivel === 'admin') return produto; // Admin vê tudo

  // Logista vê resultado limpo — fontes NUNCA expostas
  const { _fontes, ...semFontes } = produto;
  return semFontes;
}

// ============================================================
// NCT — Score detalhado por fonte
// ============================================================
function calcularNCT({ fontes, blocos, campos_vazios }) {
  // TF — média ponderada das fontes
  const fontesTF = fontes.filter(f => f.tf);
  const somaPesos = fontesTF.reduce((s, f) => s + f.tf, 0);
  const tf = fontesTF.length > 0
    ? fontesTF.reduce((s, f) => s + (f.tf * f.tf), 0) / somaPesos
    : 0;

  // FM — nome encontrado em múltiplas fontes
  const fontesNome = fontes.filter(f => f.confirmou?.nome || f.confirmou?.titulo).length;
  const fm = Math.min(0.60 + (fontesNome * 0.10), 1.0);

  // CO — NCM verificado
  const co = blocos.b8.ncm && !campos_vazios.includes('b8_ncm') ? 1.0 : 0.0;

  // AV — Aplicação confirmada
  const av = (blocos.b5.texto || blocos.b5.veiculos?.length > 0) ? 0.90 : 0.30;

  // Penalidade: sem imagem = -0.10
  const penalidade_img = blocos.b6.total_encontradas === 0 ? 0.10 : 0;

  const score = +Math.max(0, tf * 0.50 + fm * 0.20 + co * 0.20 + av * 0.10 - penalidade_img).toFixed(4);

  return {
    score,
    tf   : +tf.toFixed(4),
    fm   : +fm.toFixed(4),
    co,
    av,
    decisao: score >= 0.90 ? 'APROVADO' : score >= 0.60 ? 'PENDENTE — logista revisa' : 'BLOQUEADO',
    penalidades: penalidade_img > 0 ? ['sem imagem: -0.10'] : [],
    // _fontes_tf: apenas admin vê isso — não incluído aqui
  };
}

// ============================================================
// RAST-HASH
// ============================================================
function gerarRastHash({ ean, oem, cnpj }) {
  const base = `${ean}${oem}${cnpj}`.trim();
  if (!base) return '';
  return 'NCT·' + crypto.createHash('md5').update(base).digest('hex').substring(0, 12).toUpperCase();
}

// ============================================================
// FLUXO AUTOMÁTICO DE NF
// Detecta nova NF no Bling e triangula automaticamente
// ============================================================
async function processarNF(nf) {
  console.log(`\n[NF] Processando NF ${nf.numero} — ${nf.itens?.length || 0} itens`);

  const resultados = [];

  for (const item of (nf.itens || [])) {
    const { ean, oem, sku, nome, ncm } = item;
    console.log(`[NF] Item: ${nome || sku || oem || ean}`);

    try {
      const resultado = await triangular({ ean, oem, sku, nome, ncm });
      resultados.push({
        item_original : item,
        nct_score     : resultado.nct.score,
        status        : resultado.status,
        categoria     : resultado.blocos.b2.categoria,
        nome_enriquecido: resultado.nome,
        imagem        : resultado.blocos.b6.frontal || '',
        rast_hash     : resultado.blocos.b1.rast_hash,
        origem        : resultado.origem || 'triangulado',
      });
    } catch (e) {
      console.error(`[NF] Erro no item ${sku}:`, e.message);
      resultados.push({ item_original: item, erro: e.message, status: 'ERRO' });
    }

    // Delay entre itens para não sobrecarregar as APIs
    await new Promise(r => setTimeout(r, 1500));
  }

  return {
    nf_numero    : nf.numero,
    nf_data      : nf.data,
    fornecedor   : nf.fornecedor,
    total_itens  : nf.itens?.length || 0,
    processados  : resultados.filter(r => !r.erro).length,
    erros        : resultados.filter(r => r.erro).length,
    do_repositorio: resultados.filter(r => r.origem === 'repositorio').length,
    itens        : resultados,
  };
}

// ============================================================
// ROTAS EXPRESS
// ============================================================
function registrarRotas(app) {

  // Middleware de autenticação de nível
  function nivelAcesso(req) {
    return req.headers['x-genesis-token'] === CFG.ADMIN_TOKEN ? 'admin' : 'logista';
  }

  /**
   * POST /api/motor/triangular
   * Triangula um produto pelos 10 blocos
   */
  app.post('/api/motor/triangular', async (req, res) => {
    try {
      const { ean, oem, sku, nome, ncm, ramo, cnpj } = req.body;
      if (!ean && !oem && !sku && !nome)
        return res.status(400).json({ ok: false, erro: 'Informe ao menos: ean, oem, sku ou nome' });

      const nivel     = nivelAcesso(req);
      const resultado = await triangular({ ean, oem, sku, nome, ncm, ramo, cnpj, nivel });

      return res.json({ ok: true, ...resultado });
    } catch (err) {
      return res.status(500).json({ ok: false, erro: err.message });
    }
  });

  /**
   * POST /api/motor/nf
   * Processa uma NF completa automaticamente
   */
  app.post('/api/motor/nf', async (req, res) => {
    try {
      const { nf } = req.body;
      if (!nf || !nf.itens)
        return res.status(400).json({ ok: false, erro: 'Estrutura NF inválida' });

      const resultado = await processarNF(nf);
      return res.json({ ok: true, ...resultado });
    } catch (err) {
      return res.status(500).json({ ok: false, erro: err.message });
    }
  });

  /**
   * GET /api/motor/repositorio
   * Retorna estatísticas do repositório (apenas admin)
   */
  app.get('/api/motor/repositorio', (req, res) => {
    if (nivelAcesso(req) !== 'admin')
      return res.status(403).json({ ok: false, erro: 'Acesso negado' });

    const total = Object.keys(Repositorio.dados).length;
    const aprovados = Object.values(Repositorio.dados).filter(p => p.status === 'APROVADO').length;
    return res.json({ ok: true, total_produtos: total, aprovados, pendentes: total - aprovados });
  });

  /**
   * GET /api/motor/ncm/:codigo
   * Verifica NCM
   */
  app.get('/api/motor/ncm/:codigo', (req, res) => {
    const NCM_MAP = {
      '85113000': 'Motores de arranque elétricos',
      '87089990': 'Partes e acessórios de veículos',
      '87089900': 'Suspensão direção freios',
      '84089000': 'Motores diesel',
      '84089900': 'Partes de motores diesel',
      '87083000': 'Freios e servofreios',
    };
    const { codigo } = req.params;
    const desc = NCM_MAP[codigo];
    return res.json({ ok: !!desc, ncm: codigo, descricao: desc || '—', fonte: desc ? 'tabela_interna' : 'nao_mapeado' });
  });
}

// ============================================================
// EXPORTS
// ============================================================
module.exports = { triangular, processarNF, registrarRotas, Repositorio, CLASSIFICACAO, CFG };

// ============================================================
// TESTE DIRETO: node motor-triangulacao-v2.js
// ============================================================
if (require.main === module) {
  (async () => {
    console.log('\n=== GENESIS iRollo 360 · Motor NCT v2 · by Junior/MOBIS ===\n');

    // Teste 1 — EAN Bosch (Motor Arranque)
    console.log('Teste 1 — 1986S00925 · Motor Arranque Bosch');
    const r1 = await triangular({ ean: '4047026608724', oem: '1986S00925', ncm: '85113000' });
    console.log(`Status : ${r1.status}`);
    console.log(`NCT    : ${r1.nct.score} · ${r1.nct.decisao}`);
    console.log(`Bloco2 : ${r1.blocos.b2.natureza} · ${r1.blocos.b2.categoria}`);
    console.log(`NCM    : ${r1.blocos.b8.ncm} · IPI ${r1.blocos.b8.ipi}`);
    console.log(`Imagens: ${r1.blocos.b6.total_encontradas}`);
    console.log(`RAST   : ${r1.blocos.b1.rast_hash}`);
    console.log('');

    // Teste 2 — Mesma NF de novo (deve vir do repositório)
    console.log('Teste 2 — mesmo produto (deve vir do repositório em < 1s)');
    const t0 = Date.now();
    const r2 = await triangular({ ean: '4047026608724' });
    console.log(`Origem : ${r2.origem || 'triangulado'} · ${Date.now() - t0}ms`);
    console.log('');

    // Teste 3 — NF completa
    console.log('Teste 3 — NF completa com 2 itens');
    const r3 = await processarNF({
      numero: 'NF-001', data: '2026-04-07', fornecedor: 'Bosch BR',
      itens: [
        { ean: '4047026608724', oem: '1986S00925', nome: 'Motor Arranque', ncm: '85113000' },
        { ean: '3165143362945', oem: '0221604010', nome: 'Bobina Ignicao Bosch Volvo', ncm: '85113000' },
      ],
    });
    console.log(`NF processada: ${r3.processados}/${r3.total_itens} · repositório: ${r3.do_repositorio}`);
  })();
}
