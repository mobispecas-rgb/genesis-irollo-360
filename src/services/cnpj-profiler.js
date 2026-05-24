// ============================================================
// GENESIS iROLLO v3.1 — CNPJ PROFILER
// Consulta BrasilAPI (gratuita) + Detecta CNAE → Perfil
// ============================================================
const axios = require('axios');
const { validarCNPJ } = require('../utils/validacao');

const PERFIS_POR_CNAE = {
  '4530701': { perfil: 'AUTOPECAS', nome: 'Comércio de peças e acessórios para veículos' },
  '4530702': { perfil: 'AUTOPECAS', nome: 'Comércio a varejo de peças e acessórios novos' },
  '4530703': { perfil: 'AUTOPECAS', nome: 'Comércio a varejo de peças usadas' },
  '4541201': { perfil: 'AUTOPECAS', nome: 'Comércio de motocicletas e peças' },
  '4541202': { perfil: 'AUTOPECAS', nome: 'Comércio a varejo de peças para motocicletas' },
  '2941700': { perfil: 'AUTOPECAS_INDUSTRIAL', nome: 'Fabricação de peças para sistema motor' },
  '2942500': { perfil: 'AUTOPECAS_INDUSTRIAL', nome: 'Fabricação de peças para transmissão' },
  '2943300': { perfil: 'AUTOPECAS_INDUSTRIAL', nome: 'Fabricação de peças para sistema de freios' },
  '2944100': { perfil: 'AUTOPECAS_INDUSTRIAL', nome: 'Fabricação de peças para direção e suspensão' },
  '2945000': { perfil: 'AUTOPECAS_INDUSTRIAL', nome: 'Fabricação de material elétrico para veículos' },
  '2949299': { perfil: 'AUTOPECAS_INDUSTRIAL', nome: 'Fabricação de outras peças para veículos' },
  '4520001': { perfil: 'OFICINA', nome: 'Manutenção e reparação mecânica de veículos' },
  '4520002': { perfil: 'OFICINA', nome: 'Lanternagem e pintura de veículos' },
  '4520003': { perfil: 'OFICINA', nome: 'Manutenção elétrica de veículos' },
  '4520004': { perfil: 'OFICINA', nome: 'Alinhamento e balanceamento' },
  '4511101': { perfil: 'CONCESSIONARIA', nome: 'Comércio de automóveis novos' },
  '4511102': { perfil: 'CONCESSIONARIA', nome: 'Comércio de automóveis usados' },
  '4711301': { perfil: 'VAREJO_GERAL', nome: 'Comércio varejista em geral' },
};

const PREFIXOS_AUTOPECAS = ['294', '453', '454', '452'];

async function consultarCNPJ(cnpj) {
  const validacao = validarCNPJ(cnpj);
  if (!validacao.valido) return { ok: false, erro: validacao.motivo };
  const cnpjLimpo = validacao.cnpj_limpo;
  try {
    const resp = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`, { timeout: 10000, headers: { 'User-Agent': 'GenesisIRollo/3.1' } });
    const d = resp.data;
    return { ok: true, cnpj: cnpjLimpo, cnpj_formatado: validacao.cnpj_formatado, razao_social: d.razao_social, nome_fantasia: d.nome_fantasia || d.razao_social, situacao: d.descricao_situacao_cadastral, ativa: d.descricao_situacao_cadastral === 'ATIVA', abertura: d.data_inicio_atividade, porte: d.porte, natureza: d.natureza_juridica, cnae_principal: d.cnae_fiscal?.toString(), cnae_descricao: d.cnae_fiscal_descricao, cnaes_secundarios: (d.cnaes_secundarios || []).map(c => ({ codigo: c.codigo?.toString(), descricao: c.descricao })), endereco: { logradouro: d.logradouro, numero: d.numero, bairro: d.bairro, municipio: d.municipio, uf: d.uf, cep: d.cep }, telefone: d.ddd_telefone_1, email: d.email, socios: (d.qsa || []).map(s => ({ nome: s.nome_socio, qualificacao: s.qualificacao_socio })) };
  } catch (err) {
    if (err.response?.status === 404) return { ok: false, erro: 'CNPJ não encontrado na Receita Federal' };
    if (err.response?.status === 429) return { ok: false, erro: 'Muitas consultas — tente em 30 segundos' };
    return { ok: false, erro: `Erro na consulta: ${err.message}` };
  }
}

function detectarPerfil(cnae) {
  if (!cnae) return 'GENERICO';
  const cnaeStr = cnae.toString().replace(/\D/g, '');
  if (PERFIS_POR_CNAE[cnaeStr]) return PERFIS_POR_CNAE[cnaeStr].perfil;
  for (const prefixo of PREFIXOS_AUTOPECAS) { if (cnaeStr.startsWith(prefixo)) return 'AUTOPECAS'; }
  return 'GENERICO';
}

function obterConfigPerfil(perfil) {
  const configs = {
    AUTOPECAS: { nome_perfil: 'Autopeças & Acessórios Automotivos', nct_minimo: 0.90, campos_obrigatorios: ['oem','ncm','nome','aplicacao'], categorias_principais: ['Suspensão','Freios','Motor','Transmissão','Elétrica','Arrefecimento','Filtros','Correias','Embreagem','Direção','Amortecedores','Buchas','Rolamentos','Retentores','Juntas','Escapamento','Injeção','Iluminação','Carroceria','Vidros'], regras_ncm: ['87','84','85','40','73'], regras_imagem: { quantidade: 6, fundo_branco: true, resolucao_minima: 1000, confianca_ia_minima: 82 }, erp_principal: 'bling', marketplace: ['wix','google_shopping','mercado_livre'], prompt_ia: 'especialista técnico em autopeças automotivas brasileiras', reino_padrao: 'MINERAL', garantia_padrao: '12 meses ou 20.000 km conforme CDC Art. 8 e 26' },
    AUTOPECAS_INDUSTRIAL: { nome_perfil: 'Fabricante de Autopeças', nct_minimo: 0.92, campos_obrigatorios: ['oem','ncm','nome','aplicacao','ean'], regras_imagem: { quantidade: 6, fundo_branco: true, resolucao_minima: 1500, confianca_ia_minima: 88 }, erp_principal: 'bling', marketplace: ['wix','google_shopping'], prompt_ia: 'especialista em fabricação de autopeças com normas ABNT', reino_padrao: 'MINERAL', garantia_padrao: '12 meses conforme CDC e normas ABNT' },
    OFICINA: { nome_perfil: 'Oficina Mecânica / Serviços Automotivos', nct_minimo: 0.80, campos_obrigatorios: ['nome','ncm'], regras_imagem: { quantidade: 3, fundo_branco: false, resolucao_minima: 800, confianca_ia_minima: 70 }, erp_principal: 'bling', marketplace: ['wix'], prompt_ia: 'especialista em serviços automotivos', reino_padrao: 'MINERAL', garantia_padrao: '90 dias conforme CDC Art. 26' },
    VAREJO_GERAL: { nome_perfil: 'Comércio Varejista Geral', nct_minimo: 0.75, campos_obrigatorios: ['nome','ncm'], regras_imagem: { quantidade: 4, fundo_branco: true, resolucao_minima: 800, confianca_ia_minima: 75 }, erp_principal: 'bling', marketplace: ['wix','google_shopping'], prompt_ia: 'especialista em varejo', reino_padrao: 'MINERAL', garantia_padrao: '90 dias conforme CDC' },
    GENERICO: { nome_perfil: 'Empresa Geral', nct_minimo: 0.75, campos_obrigatorios: ['nome'], regras_imagem: { quantidade: 3, fundo_branco: true, resolucao_minima: 800, confianca_ia_minima: 75 }, erp_principal: 'bling', marketplace: ['wix'], prompt_ia: 'especialista em cadastro de produtos', reino_padrao: 'MINERAL', garantia_padrao: '90 dias conforme CDC' }
  };
  return configs[perfil] || configs.GENERICO;
}

async function criarPerfilEmpresa(cnpj) {
  const empresa = await consultarCNPJ(cnpj);
  if (!empresa.ok) return empresa;
  let perfilFinal = detectarPerfil(empresa.cnae_principal);
  if (perfilFinal === 'GENERICO' && empresa.cnaes_secundarios?.length) {
    for (const c of empresa.cnaes_secundarios) { const p = detectarPerfil(c.codigo); if (p !== 'GENERICO') { perfilFinal = p; break; } }
  }
  const config = obterConfigPerfil(perfilFinal);
  return { ok: true, empresa, perfil: perfilFinal, config, mensagem: `Empresa identificada como: ${config.nome_perfil}. Sistema configurado automaticamente.` };
}

module.exports = { consultarCNPJ, detectarPerfil, criarPerfilEmpresa, obterConfigPerfil, PERFIS_POR_CNAE };
