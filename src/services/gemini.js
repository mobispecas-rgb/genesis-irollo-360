// GENESIS iROLLO v3.6 — TRIANGULACAO MULTI-FONTE + IMAGENS REAIS
// DNA = EAN > OEM > SKU > Nome  (nunca inventa, sempre prova)
// Buscadores: Serper.dev (2500 gratis/mes) + Google CSE (backup) + BrasilAPI NCM (gratis)
// Imagens: Serper Images + Google pagemap + extracao HTML
// IA: Claude Haiku (Anthropic)
const axios = require('axios');
require('dotenv').config();
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';
const CLAUDE_HEADERS = {
  'x-api-key': '',
  'anthropic-version': '2023-06-01',
  'content-type': 'application/json'
};
const SITES_REAIS = [
  'krambeck.com.br','zenoautopecas.com.br','autoz.com.br',
  'enviapecas.com.br','natparts.com.br','mercadolivre.com.br',
  'autodoc.com.br','grupopecasecia.com.br','pecashonda.com.br'
];

async function chamarClaude(prompt, maxTokens) {
  maxTokens = maxTokens || 1500;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.length < 10) throw new Error('ANTHROPIC_API_KEY nao configurada');
  const resp = await axios.post(ANTHROPIC_URL,
    { model: MODEL, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] },
    { headers: Object.assign({}, CLAUDE_HEADERS, { 'x-api-key': apiKey }) }
  );
  return (resp.data&&resp.data.content&&resp.data.content[0]&&resp.data.content[0].text||'').trim();
}
const chamarGemini = chamarClaude;

function extrairImagemDaPagina(html, urlBase) {
  if (!html) return null;
  const padroes = [
    /og:image[^>]*content=["']([^"']+)["']/i,
    /twitter:image[^>]*content=["']([^"']+)["']/i,
    /<img[^>]*(product|produto|foto|photo|main|principal)[^>]*src=["']([^"']+\.(jpg|jpeg|png|webp))["']/i,
    /<img[^>]*src=["'](https?:[^"']+\.(jpg|jpeg|png|webp))["'][^>]*>/i
  ];
  for (var i=0;i<padroes.length;i++){
    var m=html.match(padroes[i]);
    if(m){var u=(i===2)?m[2]:m[1];if(!u)continue;
      if(u.startsWith('//'))return 'https:'+u;
      if(u.startsWith('/')&&urlBase){try{return new URL(urlBase).origin+u;}catch(e){return u;}}
      return u;
    }
  }
  return null;
}

async function buscarComSerper(query, tipo) {
  tipo=tipo||'search';
  const apiKey=process.env.SERPER_API_KEY;
  if(!apiKey||apiKey.length<10)return null;
  try{
    const ep=tipo==='images'?'https://google.serper.dev/images':'https://google.serper.dev/search';
    const resp=await axios.post(ep,{q:query,gl:'br',hl:'pt',num:10},
      {headers:{'X-API-KEY':apiKey,'Content-Type':'application/json'},timeout:6000});
    if(tipo==='images'){
      const imgs=(resp.data&&resp.data.images)||[];
      return imgs.length>0?(imgs[0].imageUrl||imgs[0].thumbnailUrl):null;
    }
    const items=(resp.data&&resp.data.organic)||[];
    return items.map(function(item){
      return{fonte:item.link?new URL(item.link).hostname:'',titulo:item.title||'',snippet:item.snippet||'',url:item.link||''};
    });
  }catch(err){console.warn('[SERPER]',err.message);return null;}
}

async function buscarComGoogle(codigo, marca) {
  marca=marca||'';
  const apiKey=process.env.GOOGLE_SEARCH_API_KEY;
  const cx=process.env.GOOGLE_SEARCH_CX;
  if(!apiKey||!cx||apiKey==='SUA_GOOGLE_SEARCH_API_KEY')return null;
  const sitesStr=SITES_REAIS.slice(0,5).map(function(s){return 'site:'+s;}).join(' OR ');
  const queries=[
    '"'+codigo+'" equivalente OR cruzamento OR OEM autopeca',
    '"'+codigo+'" '+marca+' ('+sitesStr+')'
  ];
  const resultados=[];const imgs=[];
  for(var q=0;q<queries.length;q++){
    try{
      const url='https://www.googleapis.com/customsearch/v1'+'?key='+apiKey+'&cx='+cx+'&q='+encodeURIComponent(queries[q])+'&num=5&hl=pt-BR';
      const resp=await axios.get(url,{timeout:6000});
      const items=(resp.data&&resp.data.items)||[];
      for(var i=0;i<items.length;i++){
        const it=items[i];
        resultados.push({fonte:it.displayLink||'',titulo:it.title||'',snippet:it.snippet||'',url:it.link||''});
        if(it.pagemap){const cse=it.pagemap.cse_image;const og=it.pagemap.metatags;
          if(cse&&cse[0]&&cse[0].src)imgs.push(cse[0].src);
          else if(og&&og[0]&&og[0]['og:image'])imgs.push(og[0]['og:image']);}
      }
    }catch(err){console.warn('[GOOGLE]',err.message);}
  }
  return resultados.length>0?{resultados:resultados,imagem_pagemap:imgs[0]||null}:null;
}

async function validarNCMBrasilAPI(ncmCode) {
  if(!ncmCode||ncmCode.length<4)return null;
  try{
    const cod=ncmCode.replace(/[.\-]/g,'');
    const resp=await axios.get('https://brasilapi.com.br/api/ncm/v1/'+cod,{timeout:4000});
    if(resp.data&&resp.data.codigo)return{ncm:resp.data.codigo,descricao:resp.data.descricao||'',validado:true};
  }catch(err){}
  return null;
}

async function fetchPaginaComImagem(item) {
  try{
    const resp=await axios.get(item.url,{timeout:8000,
      headers:{'User-Agent':'Mozilla/5.0 (compatible; GenesisiRollo/3.6)','Accept':'text/html','Accept-Language':'pt-BR,pt;q=0.9'},
      maxContentLength:300000});
    const html=resp.data||'';
    const imagem=extrairImagemDaPagina(html,item.url);
    const texto=html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').substring(0,8000);
    return{texto:texto,imagem:imagem,fonte:item.fonte||''};
  }catch(err){return null;}
}

async function buscarNaWeb(codigo, marca, ean) {
  marca=marca||'';ean=ean||'';
  let resultados=[],imagemPagemap=null,fonteUsada='nenhuma';
  const serperKey=process.env.SERPER_API_KEY;
  if(serperKey&&serperKey.length>10){
    const queryWeb=ean
      ?'"'+ean+'" autopeca OR "peca automotiva" OR equivalente'
      :'"'+codigo+'" '+marca+' equivalente OR OEM OR cruzamento autopeca';
    const webItems=await buscarComSerper(queryWeb,'search');
    if(webItems&&webItems.length>0){
      resultados=webItems;fonteUsada='serper';
      const queryImg=(ean||codigo)+' '+marca+' autopeca';
      imagemPagemap=await buscarComSerper(queryImg.trim(),'images');
    }
  }
  if(resultados.length===0){
    const gr=await buscarComGoogle(codigo,marca);
    if(gr){resultados=gr.resultados;imagemPagemap=gr.imagem_pagemap;fonteUsada='google_cse';}
  }
  return resultados.length>0?{resultados:resultados,imagem_pagemap:imagemPagemap,fonte:fonteUsada}:null;
}

async function cruzarCodigos(codigo, marca, ean) {
  marca=marca||'';ean=ean||'';
  console.log('[CRUZAMENTO v3.6] DNA='+(ean||codigo)+' marca='+marca);
  const webResult=await buscarNaWeb(codigo,marca,ean);
  const resultadosWeb=webResult?webResult.resultados:null;
  const imagemPagemap=webResult?webResult.imagem_pagemap:null;
  const fonteUsada=webResult?webResult.fonte:'nenhuma';
  let dadosBrutos='',imagemReal=imagemPagemap||null;
  const temDadosReais=!!(resultadosWeb&&resultadosWeb.length>0);
  if(temDadosReais){
    const paginasFetched=[];
    for(var i=0;i<Math.min(2,resultadosWeb.length);i++){
      const item=resultadosWeb[i];
      if(item.url){const p=await fetchPaginaComImagem(item);
        if(p){paginasFetched.push('=== Fonte: '+item.fonte+' ===\n'+p.texto);
          if(!imagemReal&&p.imagem)imagemReal=p.imagem;}}
    }
    const snippets=resultadosWeb.map(function(r){return '['+r.fonte+'] '+r.titulo+': '+r.snippet;}).join('\n');
    dadosBrutos='BUSCADOR: '+fonteUsada+'\nSNIPPETS:\n'+snippets;
    if(paginasFetched.length>0)dadosBrutos+='\n\nCONTEUDO:\n'+paginasFetched.join('\n\n');
  }
  let instrucaoFonte,nivelConfiancaBase,restricaoSemWeb;
  if(temDadosReais){
    instrucaoFonte='USE os dados reais abaixo. Extraia SOMENTE o que esta confirmado.\n\nDADOS REAIS DA WEB:\n'+dadosBrutos;
    nivelConfiancaBase='0.9';restricaoSemWeb='';
  }else{
    instrucaoFonte='NAO HA dados da web para este codigo.';
    nivelConfiancaBase='0.5';
    restricaoSemWeb='\nREGRA CRITICA — SEM DADOS WEB:\napplicacao_veicular: [] OBRIGATORIO — NUNCA inventar.\ncodigos_equivalentes: [] OBRIGATORIO — NUNCA inventar.\nean_codigos: [] OBRIGATORIO.\ncodigo_original_montadora: null.\nncm: null se qualquer duvida.\nnivel_confianca: maximo 0.5.';
  }
  const eannInfo=ean?'\nEAN: '+ean:'';
  const prompt=[
    'Voce e especialista em catalogos tecnicos de autopecas automotivas.',
    'PRINCIPIO ABSOLUTO: Dados inventados destroem o catalogo e aumentam CPC do Google.',
    'NUNCA invente aplicacoes veiculares, equivalentes ou EANs sem fonte verificada.',
    instrucaoFonte,restricaoSemWeb,'',
    'CODIGO (DNA): '+codigo+eannInfo+' | MARCA: '+(marca||'nao informado'),'',
    'Retorne APENAS JSON valido (sem markdown):',
    '{',
    '  "codigo_input": "'+codigo+'",',
    '  "tipo_codigo": "OEM_AFTERMARKET|OEM_ORIGINAL|EAN|SKU|REFERENCIA",',
    '  "marca_fabricante": "ou null",',
    '  "nome_peca": "Nome tecnico ou null",',
    '  "descricao_tecnica": "2-3 frases ou null",',
    '  "codigo_original_montadora": null,',
    '  "codigos_equivalentes": [],',
    '  "ean_codigos": [],',
    '  "aplicacao_veicular": [],',
    '  "sistemas_veiculo": "Embreagem|Suspensao|Freios|Motor|null",',
    '  "material_composicao": "ou null",',
    '  "dimensoes": {"diametro_mm": null, "espessura_mm": null, "peso_kg": null},',
    ' "ncm": "obrigatorio 8 digitos - use 87089900 como padrao para autopecas se incerto",',
    '  "tags_google_shopping": [],',
    '  "garantia_cdc": "ou null",',
    '  "nivel_confianca": '+nivelConfiancaBase+',',
    '  "fontes_consultadas": []',
    '}',
    'SE dados_reais=true: codigos_equivalentes=[{"marca":"VALEO","codigo":"XXXXX","tipo":"equivalente"}]',
    'SE dados_reais=true: aplicacao_veicular=[{"montadora":"Hyundai","modelo":"HR","anos":"2006-2012","motor":"2.5 8V"}]',
    'Responda SOMENTE o JSON.'
  ].join('\n');
  try{
    const resp=await chamarClaude(prompt,2000);
    const jl=resp.replace(/```json|```/g,'').trim();
    return{ok:true,cruzamento:JSON.parse(jl),imagem_real:imagemReal,fontes_reais:resultadosWeb?resultadosWeb.map(function(r){return r.fonte;}):[],dados_reais:temDadosReais,buscador_usado:fonteUsada};
  }catch(err){console.error('[CRUZAMENTO]',err.message);return{ok:false,erro:err.message};}
}

async function enriquecerProduto(dadosBrutos) {
  const oem=dadosBrutos.oem,nome=dadosBrutos.nome,ncm=dadosBrutos.ncm;
  const sku=dadosBrutos.sku,ean=dadosBrutos.ean||dadosBrutos.ean_codigo||'';
  const aplicacao=dadosBrutos.aplicacao;
  const marcaDetectada=nome?nome.split(' ')[0]:'';
  const codigoPrincipal=oem||sku||ean||nome;
  const resultado=await cruzarCodigos(codigoPrincipal,marcaDetectada,ean);
  if(!resultado.ok){
    return{ok:false,erro:resultado.erro,dados_parciais:{
      nome_enriquecido:nome||oem,
      descricao_tecnica:(nome||'Produto')+' - OEM: '+(oem||'—'),
      aplicacao_veicular:'',reino:'MINERAL',
      ncm_sugerido:ncm||null,confianca_enriquecimento:0.3
    }};
  }
  const c=resultado.cruzamento;
  const aplicacaoFormatada=Array.isArray(c.aplicacao_veicular)&&c.aplicacao_veicular.length>0
    ?c.aplicacao_veicular.map(function(v){return(v.montadora||'')+' '+(v.modelo||'')+' ('+(v.anos||'')+(v.motor?' '+v.motor:'')+')';}).join(' / ')
    :(resultado.dados_reais?(aplicacao||''):'');
  let ncmFinal=c.ncm||(resultado.dados_reais?(ncm||null):null);
  if(ncmFinal){
    try{
      const nv=await validarNCMBrasilAPI(ncmFinal.replace(/\D/g,''));
      if(nv&&nv.validado){ncmFinal=nv.ncm;console.log('[NCM] Validado:'+ncmFinal);}
      else{console.log('[NCM] BrasilAPI nao encontrou, mantendo NCM:'+ncmFinal);}
    }catch(e){}
  }
  let imagemFinal=resultado.imagem_real||null;
  if(!imagemFinal&&process.env.SERPER_API_KEY){
    const qi=((oem||sku)+' '+(nome||'')+' autopeca').trim();
    imagemFinal=await buscarComSerper(qi,'images');
  }
  const dados={
    nome_enriquecido:c.nome_peca,descricao_tecnica:c.descricao_tecnica,
    descricao_curta:((c.nome_peca||'')+' - '+(c.codigo_original_montadora||oem||'')).substring(0,160),
    aplicacao_veicular:aplicacaoFormatada,imagem_real:imagemFinal,reino:'MINERAL',
    sistema_veiculo:c.sistemas_veiculo,material_composicao:c.material_composicao,
    ncm_sugerido:ncmFinal,peso_estimado_kg:(c.dimensoes&&c.dimensoes.peso_kg)||0,
    tags_seo:c.tags_google_shopping||[],garantia_cdc:c.garantia_cdc,
    confianca_enriquecimento:c.nivel_confianca||0.5,
    buscador_usado:resultado.buscador_usado||'nenhum',
    cruzamento:{codigo_original_montadora:c.codigo_original_montadora,
      codigos_equivalentes:c.codigos_equivalentes||[],ean_codigos:c.ean_codigos||[],
      dimensoes:c.dimensoes,tipo_codigo:c.tipo_codigo,fontes:resultado.fontes_reais}
  };
  return{ok:true,dados:dados,modelo_usado:MODEL,fonte_real:resultado.dados_reais,
    buscador:resultado.buscador_usado||'nenhum',enriquecido_em:new Date().toISOString()};
}

async function gerarTituloSEO(produto) {
  const p='Gere UM UNICO titulo SEO para Google Shopping de autopecas.\nFormato: [Nome Peca] [Marca] [Codigo OEM] [Aplicacao Principal]\nMaximo: 150 caracteres.\nProduto: '+(produto.nome||'')+' | OEM: '+(produto.oem||'')+' | Aplicacao: '+(produto.aplicacao||'')+'\nResponda APENAS o titulo.';
  try{const t=await chamarClaude(p,150);return{ok:true,titulo:t.replace(/['"]/g,'').trim()};}
  catch(err){return{ok:false,titulo:produto.nome,erro:err.message};}
}

module.exports={enriquecerProduto,cruzarCodigos,gerarTituloSEO,chamarGemini,chamarClaude};