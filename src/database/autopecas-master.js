// ============================================================
// GENESIS iROLLO v3.1 — BANCO DE DADOS MASTER AUTOPEÇAS
// ============================================================

const CATEGORIAS = {
  SUSPENSAO: { nome: 'Suspensão', icone: 'S', ncms_principais: ['87086000','87089900'], subcategorias: ['Amortecedor Dianteiro','Amortecedor Traseiro','Bandeja Dianteira Superior','Bandeja Dianteira Inferior','Bandeja Traseira','Bucha de Bandeja','Bucha Estabilizadora','Barra Estabilizadora','Pivô de Suspensão','Cubo de Roda','Rolamento de Roda','Coxim de Amortecedor','Mola Helicoidal','Mola Traseira','Batente de Amortecedor','Kit Amortecedor','Bieleta de Suspensão','Manga de Eixo','Ponta de Eixo'], campos_obrigatorios: ['oem','aplicacao','ncm','posicao'], palavras_chave_seo: ['suspensão','amortecedor','bandeja','bucha','pivô','rolamento'], cpc_categoria: 'MEDIO' },
  FREIOS: { nome: 'Freios', icone: 'F', ncms_principais: ['87083000','87089900'], subcategorias: ['Pastilha de Freio','Lona de Freio','Disco de Freio','Tambor de Freio','Cilindro de Roda','Cilindro Mestre','Servo Freio','Pinça de Freio','Fluido de Freio','Kit Reparo Pinça','Mangueira de Freio'], campos_obrigatorios: ['oem','aplicacao','ncm'], palavras_chave_seo: ['freio','pastilha','disco','lona','tambor','ABS'], cpc_categoria: 'ALTO', alerta_seguranca: true },
  MOTOR: { nome: 'Motor', icone: 'M', ncms_principais: ['84099100','84099900','87089900'], subcategorias: ['Junta do Cabeçote','Kit Junta Motor','Válvula de Escape','Válvula de Admissão','Correia Dentada','Kit Correia Dentada','Tensor de Correia','Correia Poly-V','Filtro de Óleo','Filtro de Ar','Filtro de Combustível','Bronzina de Mancal','Bronzina de Biela','Anel de Segmento','Pistão','Biela','Virabrequim','Bomba de Óleo','Cabeçote'], campos_obrigatorios: ['oem','aplicacao','ncm','motor_codigo'], palavras_chave_seo: ['motor','junta','correia','filtro','válvula','pistão'], cpc_categoria: 'MUITO_ALTO' },
  TRANSMISSAO: { nome: 'Transmissão', icone: 'T', ncms_principais: ['87084000','87085000'], subcategorias: ['Embreagem Completa','Disco de Embreagem','Platô de Embreagem','Rolamento de Embreagem','Cabo de Embreagem','Cilindro de Embreagem','Semi-eixo','Homocinético','Cruzeta','Coifa de Semi-eixo'], campos_obrigatorios: ['oem','aplicacao','ncm'], palavras_chave_seo: ['embreagem','câmbio','semi-eixo','homocinético','transmissão'], cpc_categoria: 'ALTO' },
  DIRECAO: { nome: 'Direção', icone: 'D', ncms_principais: ['87088000','87089900'], subcategorias: ['Bomba de Direção Hidráulica','Caixa de Direção','Terminal de Direção','Barra de Direção','Coluna de Direção','Mangueira de Direção','Fluido de Direção','Volante'], campos_obrigatorios: ['oem','aplicacao','ncm'], palavras_chave_seo: ['direção','bomba','terminal','caixa de direção','hidráulica'], cpc_categoria: 'ALTO' },
  ARREFECIMENTO: { nome: 'Arrefecimento', icone: 'A', ncms_principais: ['87089100','84099900'], subcategorias: ['Radiador','Bomba D\'Água','Tampa do Radiador','Mangueira do Radiador','Ventoinha','Eletroventilador','Termostato','Junta da Bomba D\'Água','Reservatório de Expansão','Fluido de Arrefecimento'], campos_obrigatorios: ['oem','aplicacao','ncm'], palavras_chave_seo: ['radiador','bomba d\'água','arrefecimento','termostato','ventoinha'], cpc_categoria: 'MEDIO' },
  ELETRICA: { nome: 'Elétrica e Eletrônica', icone: 'E', ncms_principais: ['85122000','85123000','87089900'], subcategorias: ['Alternador','Motor de Partida','Sensor MAP','Sensor TPS','Sensor Lambda','Sensor de Temperatura','Sensor de Rotação','Bobina de Ignição','Módulo de Ignição','Central de Injeção','Bico Injetor','Relé','Fusível','Farol','Lanterna'], campos_obrigatorios: ['oem','aplicacao','ncm'], palavras_chave_seo: ['alternador','sensor','bobina','injeção','elétrica','sonda'], cpc_categoria: 'MUITO_ALTO' },
  FILTROS: { nome: 'Filtros', icone: 'Fi', ncms_principais: ['84219900','84212100'], subcategorias: ['Filtro de Óleo','Filtro de Ar','Filtro de Combustível','Filtro de Cabine','Filtro de Transmissão','Filtro Hidráulico','Filtro de Diesel'], campos_obrigatorios: ['oem','aplicacao','ncm'], palavras_chave_seo: ['filtro','óleo','ar','combustível','cabine'], cpc_categoria: 'BAIXO' },
  INJECAO: { nome: 'Injeção Eletrônica', icone: 'I', ncms_principais: ['84099100','84099900'], subcategorias: ['Bico Injetor','Bomba de Combustível','Corpo de Borboleta','MAP','TPS','IAC','MAF','Regulador de Pressão','Rail de Injetores','Central de Injeção'], campos_obrigatorios: ['oem','aplicacao','ncm'], palavras_chave_seo: ['injeção eletrônica','bico injetor','sensor','EFI','combustível'], cpc_categoria: 'MUITO_ALTO' },
  ESCAPAMENTO: { nome: 'Escapamento', icone: 'Es', ncms_principais: ['87089200'], subcategorias: ['Coletor de Escape','Catalisador','Silencioso Traseiro','Tubo de Escape','Junta do Escapamento'], campos_obrigatorios: ['oem','aplicacao','ncm'], palavras_chave_seo: ['escapamento','catalisador','silencioso','coletor'], cpc_categoria: 'MEDIO' },
  CARROCERIA: { nome: 'Carroceria e Vidros', icone: 'C', ncms_principais: ['87082900','70071100'], subcategorias: ['Para-choque Dianteiro','Para-choque Traseiro','Grade','Farol','Lanterna','Retrovisor','Para-brisa','Vidro Lateral','Vidro Traseiro','Soleira','Friso Lateral','Capô'], campos_obrigatorios: ['oem','aplicacao','ncm','lado'], palavras_chave_seo: ['para-choque','farol','vidro','lataria','carroceria'], cpc_categoria: 'MEDIO' }
};

const NCM_AUTOPECAS = {
  '87086000': { descricao: 'Suspensões e suas partes', aliquota_ipi: 5, cest: '17.039.00' },
  '87088000': { descricao: 'Aparelhos de direção', aliquota_ipi: 5, cest: '17.039.00' },
  '87083000': { descricao: 'Freios e servofreios e suas partes', aliquota_ipi: 5, cest: '17.034.00' },
  '87084000': { descricao: 'Caixas de velocidades e suas partes', aliquota_ipi: 5, cest: '17.039.00' },
  '87085000': { descricao: 'Eixos com diferencial e suas partes', aliquota_ipi: 5, cest: '17.039.00' },
  '87082900': { descricao: 'Outras partes de carroçaria', aliquota_ipi: 5, cest: '17.039.00' },
  '87081000': { descricao: 'Para-choques e suas partes', aliquota_ipi: 5, cest: '17.039.00' },
  '87089100': { descricao: 'Radiadores e suas partes', aliquota_ipi: 5, cest: '17.039.00' },
  '87089200': { descricao: 'Silenciosos e tubos de escape', aliquota_ipi: 5, cest: '17.039.00' },
  '87089300': { descricao: 'Embreagens e suas partes', aliquota_ipi: 5, cest: '17.039.00' },
  '87089900': { descricao: 'Outras partes e acessórios para veículos', aliquota_ipi: 5, cest: '17.039.00' },
  '84099100': { descricao: 'Partes para motores de ignição por centelha', aliquota_ipi: 0 },
  '84099900': { descricao: 'Outras partes de motores', aliquota_ipi: 0 },
  '85122000': { descricao: 'Aparelhos de iluminação e sinalização', aliquota_ipi: 10 },
  '85123000': { descricao: 'Buzinas e aparelhos de sinalização acústica', aliquota_ipi: 10 },
  '84219900': { descricao: 'Partes de aparelhos para filtrar', aliquota_ipi: 0 },
  '84212100': { descricao: 'Filtros de óleo ou combustível', aliquota_ipi: 0 },
  '40169300': { descricao: 'Juntas, gaxetas e retentores de borracha', aliquota_ipi: 0 },
  '40169990': { descricao: 'Outras obras de borracha', aliquota_ipi: 0 },
  '40103200': { descricao: 'Correias de transmissão trapezoidais', aliquota_ipi: 0 },
  '40103900': { descricao: 'Outras correias de transmissão', aliquota_ipi: 0 }
};

const VEICULOS_POPULARES = {
  FIAT: ['Uno','Palio','Siena','Strada','Ducato','Toro','Cronos','Mobi','Argo'],
  VOLKSWAGEN: ['Gol','Polo','Voyage','Fox','Golf','Parati','Saveiro','T-Cross','Amarok'],
  CHEVROLET: ['Onix','Prisma','Celta','Corsa','Classic','S10','Spin','Tracker','Montana'],
  FORD: ['Ka','Fiesta','Focus','EcoSport','Ranger','Transit','Fusion'],
  HYUNDAI: ['HB20','HB20S','Creta','Tucson','HR','ix35'],
  TOYOTA: ['Corolla','Hilux','Etios','Yaris','SW4','RAV4'],
  HONDA: ['Civic','Fit','City','HR-V','CR-V','WR-V'],
  NISSAN: ['March','Versa','Frontier','Kicks','Sentra'],
  RENAULT: ['Sandero','Logan','Kwid','Duster','Oroch','Master'],
  JEEP: ['Renegade','Compass','Commander'],
  MITSUBISHI: ['L200','Outlander','Eclipse Cross','Pajero'],
  KIA: ['Sportage','Sorento','Cerato','Picanto'],
  PEUGEOT: ['206','207','208','2008','308','Partner','Boxer'],
  CITROEN: ['C3','C4','Berlingo','Jumper','Aircross'],
  MERCEDES: ['Sprinter','Actros','Atego','Axor'],
  IVECO: ['Daily','Tector','Stralis'],
  VOLVO: ['FH','FM','FMX','VM'],
  SCANIA: ['R','G','P','S'],
  MAN: ['TGX','TGS','TGM','TGL']
};

const REGRAS_INDEXACAO = {
  titulo: { formato: '[Categoria] [Material/Tipo] [Marca] [OEM] [Aplicação Veicular]', max_caracteres: 150, obrigatorio_incluir: ['oem','aplicacao'], exemplo: 'Pastilha Freio Dianteira TRIMGO BDJ0430 Honda Civic 2001-2006' },
  descricao_curta: { max_caracteres: 160, incluir: ['ncm','ean','aplicacao'] },
  descricao_longa: { min_palavras: 80, max_palavras: 300, incluir: ['especificacoes_tecnicas','aplicacao_detalhada','garantia_cdc'] },
  imagens: { quantidade_ideal: 6, resolucao_minima: '1000x1000px', formato: 'JPG ou PNG', fundo: 'Branco (#FFFFFF)', slots: ['Principal — frontal fundo branco','Lateral 90° — dimensões','Detalhe — código gravado','Conexão — encaixes','Embalagem — caixa original','Instalada — no veículo'] },
  google_shopping: { campos_obrigatorios: ['id','title','description','link','image_link','price','brand','mpn','gtin'], categoria_google: 'Vehicles & Parts > Vehicle Parts & Accessories', condicao: 'new' }
};

function sugerirCategoria(nomeProduto) {
  const nome = (nomeProduto || '').toLowerCase();
  const mapa = {
    SUSPENSAO:     ['amortecedor','bandeja','bucha','pivô','pivo','rolamento','coxim','mola','bieleta','manga de eixo'],
    FREIOS:        ['pastilha','lona','disco','tambor','cilindro','pinça','pinca','servo freio','freio'],
    MOTOR:         ['junta','correia dentada','tensor','filtro de óleo','filtro de ar','pistão','piston','biela','válvula','valvula','comando'],
    TRANSMISSAO:   ['embreagem','disco de embreagem','platô','semi-eixo','homocinético','cruzeta','câmbio'],
    DIRECAO:       ['direção','direcao','bomba de direção','terminal','caixa de direção','barra de direção'],
    ARREFECIMENTO: ['radiador','bomba d\'água','termostato','ventoinha','eletroventilador'],
    ELETRICA:      ['alternador','motor de partida','sensor','sonda','bobina','módulo','bico injetor','farol','lanterna'],
    FILTROS:       ['filtro de combustível','filtro de cabine','filtro hidráulico'],
    INJECAO:       ['injetor','corpo de borboleta','map','tps','iac','maf'],
    ESCAPAMENTO:   ['escapamento','catalisador','silencioso','coletor','tubo de escape'],
    CARROCERIA:    ['para-choque','grade','retrovisor','para-brisa','vidro','soleira','friso','capô']
  };
  for (const [cat, palavras] of Object.entries(mapa)) {
    if (palavras.some(p => nome.includes(p))) return { categoria: cat, dados: CATEGORIAS[cat] };
  }
  return { categoria: 'GERAL', dados: null };
}

module.exports = { CATEGORIAS, NCM_AUTOPECAS, VEICULOS_POPULARES, REGRAS_INDEXACAO, sugerirCategoria };
