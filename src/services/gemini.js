// ============================================================
// GENESIS iROLLO v3.7 — TRIANGULACAO MULTI-FONTE + IMAGENS REAIS
// DNA = EAN > OEM > SKU > Nome (nunca inventa, sempre prova)
// REGRA ABSOLUTA: O NOME DO PRODUTO e o DNA principal sempre
// Buscadores: Serper.dev (2500 gratis/mes) + Google CSE (backup) + BrasilAPI NCM (gratis)
// Imagens: Serper Images — 6 imagens normais, sem bloqueio por angulo
// IA: Claude Haiku (Anthropic)
// FIX v3.7: reconhece DNA em TODAS as etapas — sem alucinacao
// ============================================================
const axios = require('axios');
require('dotenv').config();
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5';
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
      // Retorna array de ate 6 URLs de imagem — sem validacao por angulo
      return imgs.slice(0,6).map(function(img){return img.imageUrl||img.thumbnailUrl;}).filter(Boolean);
    }
    const items=(resp.data&&resp.data.organic)||[];
    return items.map(function(item){
      return{fonte:item.link?new URL(item.link).hostname:'',titulo:item.title||'',snippet:item.snippet||'',url:item.link||''};
    });
  }catch(err){console.warn('[SERPER]',err.message);return null;}
}

async function buscarComGoogle(codigo, nome, marca) {
  marca=marca||'';
  const apiKey=process.env.GOOGLE_SEARCH_API_KEY;
  const cx=process.env.GOOGLE_SEARCH_CX;
  if(!apiKey||!cx||apiKey==='SUA_GOOGLE_SEARCH_API_KEY')return null;
  const sitesStr=SITES_REAIS.slice(0,5).map(function(s){return 'site:'+s;}).join(' OR ');
  // Usa NOME do produto (DNA) como query principal
  const queries=[
    '"'+nome+'" equivalente OR cruzamento OR OEM autopeca',
    '"'+(codigo||nome)+'" '+marca+' ('+sitesStr+')'
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
      headers:{'User-Agent':'Mozilla/5.0 (compatible; GenesisiRollo/3.7)','Accept':'text/html','Accept-Language':'pt-BR,pt;q=0.9'},
      maxContentLength:300000});
    const html=resp.data||'';
    const imagem=extrairImagemDaPagina(html,item.url);
    const texto=html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').substring(0,8000);
    return{texto:texto,imagem:imagem,fonte:item.fonte||''};
  }catch(err){return null;}
}

// FIX v3.7: busca usando NOME do produto como DNA principal
async function buscarNaWeb(codigo, nome, marca, ean) {
  marca=marca||'';ean=ean||'';nome=nome||'';
  let resultados=[],imagensReais=[],fonteUsada='nenhuma';
  const serperKey=process.env.SERPER_API_KEY;
  if(serperKey&&serperKey.length>10){
    // PRIORIDADE: busca pelo NOME completo do produto (DNA)
    // Se o codigo e puramente numerico (SKU), usa o nome como identidade
    const codigoEhSKUNumerico = /^\d+$/.test((codigo||'').trim());
    const queryIdentidade = codigoEhSKUNumerico
      ? '"'+nome+'" autopeca OR "peca automotiva"'
      : (ean
          ? '"'+ean+'" autopeca OR "peca automotiva" OR equivalente'
          : '"'+nome+'" "'+(codigo||'')+'" equivalente OR OEM OR cruzamento autopeca');
    console.log('[BUSCA v3.7] DNA query:', queryIdentidade);
    const webItems=await buscarComSerper(queryIdentidade,'search');
    if(webItems&&webItems.length>0){
      resultados=webItems;fonteUsada='serper';
      // Busca imagens usando nome + codigo
      const queryImg=(nome+' '+(codigoEhSKUNumerico?'':codigo)+' autopeca').trim();
      const imgsArr=await buscarComSerper(queryImg,'images');
      if(Array.isArray(imgsArr))imagensReais=imgsArr;
      else if(imgsArr)imagensReais=[imgsArr];
    }
  }
  if(resultados.length===0){
    const gr=await buscarComGoogle(codigo,nome,marca);
    if(gr){resultados=gr.resultados;if(gr.imagem_pagemap)imagensReais=[gr.imagem_pagemap];fonteUsada='google_cse';}
  }
  return resultados.length>0?{resultados:resultados,imagensReais:imagensReais,fonte:fonteUsada}:null;
}

// FIX v3.7: cruzarCodigos recebe nome do produto e propaga DNA em todo prompt
async function cruzarCodigos(codigo, nome, marca, ean) {
  marca=marca||'';ean=ean||'';nome=nome||codigo||'';
  console.log('[CRUZAMENTO v3.7] DNA nome='+nome+' codigo='+codigo+' marca='+marca);
  const webResult=await buscarNaWeb(codigo,nome,marca,ean);
  const resultadosWeb=webResult?webResult.resultados:null;
  const imagensReais=webResult?webResult.imagensReais:[];
  const fonteUsada=webResult?webResult.fonte:'nenhuma';
  let dadosBrutos='',imagemReal=(imagensReais&&imagensReais[0])||null;
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
    instrucaoFonte='USE os dados reais abaixo. Extraia SOMENTE o que esta confirmado sobre o produto "'+nome+'".\n\nDADOS REAIS DA WEB:\n'+dadosBrutos;
    nivelConfiancaBase='0.9';restricaoSemWeb='';
  }else{
    instrucaoFonte='NAO HA dados da web para este produto.';
    nivelConfiancaBase='0.5';
    restricaoSemWeb='\nREGRA CRITICA — SEM DADOS WEB:\napplicacao_veicular: [] OBRIGATORIO — NUNCA inventar.\ncodigos_equivalentes: [] OBRIGATORIO — NUNCA inventar.\nean_codigos: [] OBRIGATORIO.\ncodigo_original_montadora: null.\nncm: use 87089900 apenas se autopeca; null se incerto.\nnivel_confianca: maximo 0.5.';
  }
  const eannInfo=ean?'\nEAN: '+ean:'';
  // FIX v3.7: o NOME do produto esta sempre no topo do prompt — DNA absoluto
  const prompt=[
    'Voce e especialista em catalogos tecnicos de autopecas automotivas.',
    'PRINCIPIO ABSOLUTO: O NOME DO PRODUTO abaixo e a identidade (DNA) desta peca.',
    'NUNCA substitua o produto por outro. NUNCA invente aplicacoes, equivalentes ou EANs sem fonte.',
    '',
    'PRODUTO (DNA ABSOLUTO): "'+nome+'"',
    'CODIGO: '+(codigo||'nao informado')+eannInfo,
    'MARCA: '+(marca||'nao informado'),
    '',
    instrucaoFonte,
    restricaoSemWeb,
    '',
    'VERIFICACAO OBRIGATORIA: Os dados da web acima sao sobre "'+nome+'"?',
    'SE NAO forem sobre este produto especifico, use nivel_confianca <= 0.3 e deixe campos em branco.',
    '',
    'Retorne APENAS JSON valido (sem markdown):',
    '{',
    ' "codigo_input": "'+(codigo||nome)+'",',
    ' "tipo_codigo": "OEM_AFTERMARKET|OEM_ORIGINAL|EAN|SKU|REFERENCIA",',
    ' "marca_fabricante": "ou null",',
    ' "nome_peca": "Nome tecnico EXATO baseado em: '+nome+' — ou null se nao confirmado",',
    ' "descricao_tecnica": "2-3 frases especificas sobre '+nome+' — ou null",',
    ' "codigo_original_montadora": null,',
    ' "codigos_equivalentes": [],',
    ' "ean_codigos": [],',
    ' "aplicacao_veicular": [],',
    ' "sistemas_veiculo": "Embreagem|Suspensao|Freios|Motor|Fixacao|null",',
    ' "material_composicao": "ou null",',
    ' "dimensoes": {"diametro_mm": null, "espessura_mm": null, "peso_kg": null},',
    ' "ncm": "8 digitos — use 87089900 como padrao para autopecas se incerto",',
    ' "tags_google_shopping": [],',
    ' "garantia_cdc": "ou null",',
    ' "nivel_confianca": '+nivelConfiancaBase+',',
    ' "fontes_consultadas": []',
    '}',
    'SE dados_reais=true E fontes confirmam o produto: codigos_equivalentes=[{"marca":"VALEO","codigo":"XXXXX","tipo":"equivalente"}]',
    'SE dados_reais=true E fontes confirmam o produto: aplicacao_veicular=[{"montadora":"Hyundai","modelo":"HR","anos":"2006-2012","motor":"2.5 8V"}]',
    'Responda SOMENTE o JSON.'
  ].join('\n');
  try{
    const resp=await chamarClaude(prompt,2000);
    const jl=resp.replace(/```json|```/g,'').trim();
    return{ok:true,cruzamento:JSON.parse(jl),imagensReais:imagensReais,imagemReal:imagemReal,fontes_reais:resultadosWeb?resultadosWeb.map(function(r){return r.fonte;}):[],dados_reais:temDadosReais,buscador_usado:fonteUsada};
  }catch(err){console.error('[CRUZAMENTO]',err.message);return{ok:false,erro:err.message};}
}

// FIX v3.7: passa NOME como DNA para cruzarCodigos e busca 6 imagens reais
async function enriquecerProduto(dadosBrutos) {
  const oem=dadosBrutos.oem,nome=dadosBrutos.nome,ncm=dadosBrutos.ncm;
  const sku=dadosBrutos.sku,ean=dadosBrutos.ean||dadosBrutos.ean_codigo||'';
  const aplicacao=dadosBrutos.aplicacao;
  // DNA: usa codigo OEM real se nao for puramente numerico; caso contrario usa SKU/EAN
  const codigoPrincipal=oem&&!/^\d+$/.test(oem.trim())?oem:(sku&&!/^\d+$/.test(sku.trim())?sku:(ean||''));
  // Passa NOME como segundo argumento — DNA absoluto da peca
  const resultado=await cruzarCodigos(codigoPrincipal,nome,'',ean);
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
  // FIX v3.7: usa array de 6 imagens reais (sem validacao por angulo que bloqueava tudo)
  const imagensReais=resultado.imagensReais||[];
  let imagemFinal=resultado.imagemReal||null;
  // Se nao tem imagem, busca por serper usando nome do produto
  if(imagensReais.length===0&&process.env.SERPER_API_KEY){
    const qi=(nome+' '+(oem&&!/^\d+$/.test(oem)?oem:'')+' autopeca').trim();
    const imgsArr=await buscarComSerper(qi,'images');
    if(Array.isArray(imgsArr)&&imgsArr.length>0){
      imagensReais.push.apply(imagensReais,imgsArr);
      imagemFinal=imagensReais[0];
    }else if(imgsArr){imagemFinal=imgsArr;}
  }
  // Monta galeria de ate 6 imagens normais (sem bloqueio por angulo)
  const galeria=imagensReais.slice(0,6).map(function(url,idx){
    return{url:url,slot:idx+1,status:'DISPONIVEL'};
  });
  const dados={
    nome_enriquecido:c.nome_peca||nome,// nunca perde o nome original
    descricao_tecnica:c.descricao_tecnica,
    descricao_curta:((c.nome_peca||nome)+' - '+(c.codigo_original_montadora||oem||'')).substring(0,160),
    aplicacao_veicular:aplicacaoFormatada,
    imagem_real:imagemFinal,
    galeria_imagens:galeria,// 6 imagens normais sem validacao por angulo
    total_imagens:galeria.length,
    reino:'MINERAL',
    sistema_veiculo:c.sistemas_veiculo,
    material_composicao:c.material_composicao,
    ncm_sugerido:ncmFinal,
    peso_estimado_kg:(c.dimensoes&&c.dimensoes.peso_kg)||0,
    tags_seo:c.tags_google_shopping||[],
    garantia_cdc:c.garantia_cdc,
    confianca_enriquecimento:c.nivel_confianca||0.5,
    buscador_usado:resultado.buscador_usado||'nenhum',
    cruzamento:{
      codigo_original_montadora:c.codigo_original_montadora,
      codigos_equivalentes:c.codigos_equivalentes||[],
      ean_codigos:c.ean_codigos||[],
      dimensoes:c.dimensoes,
      tipo_codigo:c.tipo_codigo,
      fontes:resultado.fontes_reais
    }
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
