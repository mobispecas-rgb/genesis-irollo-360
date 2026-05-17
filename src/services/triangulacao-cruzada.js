// ============================================================
// GENESIS iROLLO — TRIANGULAÇÃO CRUZADA DE PEÇAS v1.0
// Gemini sugere equivalências entre marcas por OEM
// WEGA <-> BOSCH <-> MAHLE <-> MANN <-> OEM original
// ============================================================
const { chamarGemini } = require('./gemini');

const MARCAS_FILTRO    = ['Wega','Fram','Tecfil','Bosch','Mann','Mahle','Denso','Filtran'];
const MARCAS_IGNICAO   = ['Bosch','NGK','Denso','Champion','Beru','Motorcraft'];
const MARCAS_FREIO     = ['Fremax','Bosch','Jurid','Ferodo','ATE','TRW','Bendix'];
const MARCAS_CORREIA   = ['Gates','Dayco','Contitech','SKF','INA','Bosch'];
const MARCAS_SUSPENSAO = ['Monroe','Cofap','Nakata','ZF','Sachs','Boge','Kayaba'];
const MARCAS_ELETRICO  = ['Bosch','Denso','Valeo','Delphi','Siemens','Magneti Marelli'];
const MARCAS_UNIVERSAL = ['Bosch','Gates','SKF','Denso','Delphi','FAG','NSK'];

function getMarcasPorCategoria(cat = '') {
  if (/filtro|filter/i.test(cat))              return MARCAS_FILTRO;
  if (/igni|vela|bobina|coil/i.test(cat))      return MARCAS_IGNICAO;
  if (/freio|brake|disco|pastilha/i.test(cat)) return MARCAS_FREIO;
  if (/correia|belt|tensor/i.test(cat))        return MARCAS_CORREIA;
  if (/suspens|amort|mola|barra/i.test(cat))   return MARCAS_SUSPENSAO;
  if (/eletri|motor|sensor|injetor/i.test(cat))return MARCAS_ELETRICO;
  return MARCAS_UNIVERSAL;
}

async function triangularPecas(produto) {
  const { oem, nome, ncm, aplicacao, categoria } = produto;
  const marcas = getMarcasPorCategoria(categoria || nome || '');
  const prompt = 'Voce e um especialista em equivalencia de autopecas automotivas brasileiras.' +
    ' Para o produto abaixo, liste as pecas EQUIVALENTES/CAMBIAVEIS de outras marcas.' +
    ' REGRA: So liste equivalencias CONFIRMADAS. Se nao souber com certeza, omita.' +
    ' PRODUTO: Nome=' + (nome||'?') + ' OEM=' + (oem||'?') + ' NCM=' + (ncm||'?') +
    ' Aplicacao=' + (aplicacao||'?') + ' Categoria=' + (categoria||'?') +
    ' Marcas: ' + marcas.join(', ') +
    ' Retorne APENAS JSON: {"triangulo":[{"marca":"","codigo":"","tipo":"Original|Paralela|Remanufaturada","qualidade":"Premium|Linha|Economica","disponivel_brasil":true,"observacao":""}],"oem_original":"' + (oem||'') + '","nome_tecnico":"","aplicacao_confirmada":"","intercambiaveis":true,"aviso":""}';
  try {
    const raw = await chamarGemini(prompt, 1200);
    const json = JSON.parse(raw.replace(/```json|```/g, '').trim());
    return { ok:true, produto_base:{ oem,nome,ncm,aplicacao }, ...json, triangulado_em:new Date().toISOString() };
  } catch(err) {
    console.error('[CRUZADA] Erro:', err.message);
    return { ok:false, erro:err.message, produto_base:{ oem,nome } };
  }
}

async function buscarImagensProduto(oem, nome, limite = 6) {
  const CX  = process.env.GOOGLE_SEARCH_CX  || '';
  const KEY = process.env.GOOGLE_SEARCH_KEY || '';
  const termo = (oem + ' ' + nome + ' autopeca').trim();
  if (CX && KEY) {
    try {
      const axios = require('axios');
      const resp = await axios.get('https://www.googleapis.com/customsearch/v1',
        { params:{ key:KEY, cx:CX, q:termo, searchType:'image', num:limite, imgSize:'medium', safe:'active' }, timeout:8000 });
      return { ok:true, imagens:(resp.data.items||[]).map((it,i)=>({ posicao:i+1, url:it.link, thumb:it.image?.thumbnailLink||it.link, titulo:it.title, fonte:it.displayLink, selecionada:false })), termo, fonte:'google_api' };
    } catch(e) { console.warn('[IMAGENS] Google falhou:', e.message); }
  }
  const te = encodeURIComponent(termo);
  const oe = encodeURIComponent(oem||nome||'');
  const fb = [
    { posicao:1, url:'https://www.google.com/search?q='+te+'&tbm=isch', thumb:null, titulo:'Google: '+termo, fonte:'google', selecionada:false },
    { posicao:2, url:'https://www.bing.com/images/search?q='+te, thumb:null, titulo:'Bing: '+termo, fonte:'bing', selecionada:false },
    { posicao:3, url:'https://www.google.com/search?q='+oe+'&tbm=isch', thumb:null, titulo:'Google OEM: '+oem, fonte:'google', selecionada:false },
    { posicao:4, url:'https://www.bing.com/images/search?q='+oe, thumb:null, titulo:'Bing OEM: '+oem, fonte:'bing', selecionada:false },
    { posicao:5, url:'https://www.google.com/search?q='+oe+'+original&tbm=isch', thumb:null, titulo:'Google original', fonte:'google', selecionada:false },
    { posicao:6, url:'https://www.bing.com/images/search?q='+oe+'+original', thumb:null, titulo:'Bing original', fonte:'bing', selecionada:false },
  ];
  return { ok:true, imagens:fb.slice(0,limite), termo, fonte:'fallback_links',
    aviso:'Configure GOOGLE_SEARCH_KEY e GOOGLE_SEARCH_CX no Render para busca automatica de imagens' };
}

const imgSelecionadas = {};
function salvarImagemSelecionada(oem, url, posicao) {
  imgSelecionadas[oem] = { url, posicao, em:new Date().toISOString() };
  console.log('[IMAGENS] Logista selecionou #'+posicao+' para OEM '+oem);
  return { ok:true, oem, imagem_salva:url };
}
function getImagemSalva(oem) { return imgSelecionadas[oem]||null; }

module.exports = { triangularPecas, buscarImagensProduto, salvarImagemSelecionada, getImagemSalva, getMarcasPorCategoria };
