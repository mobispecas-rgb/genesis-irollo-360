/**
 * @copyright 2026 Jose Nunes Junior / MOBIS Pecas
 * @license Proprietario — Todos os direitos reservados
 *
 * conector-base.js
 * Genesis iRollo 360 · genesisindexia.com.br
 *
 * CLASSE BASE UNIVERSAL — CONECTORES PERSONALIZADOS
 *
 * O logista configura ONCE:
 * - Tipo de conector (ERP / Scraper / Mídia / Banco)
 * - Credenciais (criptografadas)
 * - Mapeamento de campos (Genesis → sistema destino)
 * - Intervalo de atualização
 * - Destino dos dados
 *
 * Depois tudo é automático.
 *
 * USO:
 *   const { ConectorBling } = require('./conector-bling');
 *   const c = new ConectorBling({ client_id, client_secret });
 *   await c.enviarProduto(produto);
 */

const axios  = require('axios');
const crypto = require('crypto');
const fs     = require('fs');

// ============================================================
// CHAVE DE CRIPTOGRAFIA DAS CREDENCIAIS
// ============================================================
const CHAVE = process.env.GENESIS_CRYPT_KEY || 'genesis-iRollo-360-chave-padrao-2026';

function criptografar(texto) {
  const iv  = crypto.randomBytes(16);
  const key = crypto.scryptSync(CHAVE, 'salt', 32);
  const c   = crypto.createCipheriv('aes-256-cbc', key, iv);
  return iv.toString('hex') + ':' + Buffer.concat([c.update(texto), c.final()]).toString('hex');
}

function descriptografar(cifra) {
  try {
    const [ivHex, dados] = cifra.split(':');
    const iv  = Buffer.from(ivHex, 'hex');
    const key = crypto.scryptSync(CHAVE, 'salt', 32);
    const d   = crypto.createDecipheriv('aes-256-cbc', key, iv);
    return Buffer.concat([d.update(Buffer.from(dados, 'hex')), d.final()]).toString();
  } catch (_) { return ''; }
}

// ============================================================
// CONFIGURAÇÕES SALVAS DOS CONECTORES
// Cada cliente tem seus conectores salvos em JSON criptografado
// ============================================================
const CONF_PATH = process.env.CONF_PATH || './conectores-config.json';

const ConfigStore = {
  dados: {},

  carregar() {
    try {
      if (fs.existsSync(CONF_PATH))
        this.dados = JSON.parse(fs.readFileSync(CONF_PATH, 'utf8'));
    } catch (_) {}
  },

  salvar() {
    fs.writeFileSync(CONF_PATH, JSON.stringify(this.dados, null, 2));
  },

  // Salva conector de um cliente
  set(clienteId, nomeConector, config) {
    if (!this.dados[clienteId]) this.dados[clienteId] = {};
    // Criptografa credenciais sensíveis
    const seguro = { ...config };
    ['client_secret', 'api_key', 'password', 'token', 'access_token', 'refresh_token'].forEach(campo => {
      if (seguro[campo]) seguro[campo] = criptografar(seguro[campo]);
    });
    this.dados[clienteId][nomeConector] = { ...seguro, ativo: true, criado_em: new Date().toISOString() };
    this.salvar();
  },

  // Retorna conector de um cliente (descriptografa credenciais)
  get(clienteId, nomeConector) {
    const conf = this.dados[clienteId]?.[nomeConector];
    if (!conf) return null;
    const decr = { ...conf };
    ['client_secret', 'api_key', 'password', 'token', 'access_token', 'refresh_token'].forEach(campo => {
      if (decr[campo]) decr[campo] = descriptografar(decr[campo]);
    });
    return decr;
  },

  // Lista todos os conectores de um cliente (sem credenciais)
  listar(clienteId) {
    const confs = this.dados[clienteId] || {};
    return Object.entries(confs).map(([nome, c]) => ({
      nome,
      tipo    : c.tipo,
      ativo   : c.ativo,
      destino : c.destino,
      criado  : c.criado_em,
    }));
  },
};

ConfigStore.carregar();

// ============================================================
// CLASSE BASE — todos os conectores herdam daqui
// ============================================================
class ConectorBase {
  /**
   * @param {Object} config
   * @param {string} config.tipo        — 'bling' | 'meli' | 'wix' | 'shopify' | 'scraper' | 'gdrive' | 'whatsapp' | 'custom'
   * @param {string} config.nome        — nome amigável ex: "Meu Bling MOBIS"
   * @param {string} config.clienteId   — CNPJ ou ID do cliente
   * @param {Object} config.credenciais — depende do tipo
   * @param {Object} config.mapeamento  — { campo_genesis: 'campo_destino', ... }
   * @param {string} config.destino     — 'bling' | 'gdrive' | 'vps' | 'wix'
   * @param {number} config.intervalo_h — intervalo de sync em horas (para scrapers)
   */
  constructor(config = {}) {
    this.tipo       = config.tipo       || 'custom';
    this.nome       = config.nome       || 'Conector Personalizado';
    this.clienteId  = config.clienteId  || '';
    this.creds      = config.credenciais || {};
    this.mapeamento = config.mapeamento  || this._mapeamentoPadrao();
    this.destino    = config.destino     || 'bling';
    this.intervalo  = config.intervalo_h || 24;
    this.timeout    = config.timeout_ms  || 10000;
    this.logs       = [];
  }

  // ============================================================
  // MAPEAMENTO PADRÃO Genesis → destino
  // O logista pode sobrescrever cada campo
  // ============================================================
  _mapeamentoPadrao() {
    return {
      // Genesis campo    : campo no sistema destino
      nome              : 'nome',
      ean               : 'codigo_barras',
      oem               : 'codigo_fornecedor',
      sku               : 'codigo',
      fabricante        : 'marca',
      ncm               : 'ncm',
      ipi               : 'ipi',
      cfop_venda        : 'cfop',
      origem            : 'origem',
      preco             : 'preco_venda',
      aplicacao         : 'descricao_complementar',
      imagem_url        : 'imagem_url',
      seo_title         : 'nome_ecommerce',
      seo_desc          : 'descricao_ecommerce',
      categoria         : 'categoria',
      unidade           : 'unidade',
    };
  }

  // ============================================================
  // MAPEAR produto Genesis → formato do sistema destino
  // Aplica o mapeamento personalizado do logista
  // ============================================================
  mapear(produto) {
    const b1 = produto.blocos?.b1 || {};
    const b2 = produto.blocos?.b2 || {};
    const b8 = produto.blocos?.b8 || {};
    const b9 = produto.blocos?.b9 || {};
    const b6 = produto.blocos?.b6 || {};

    // Objeto fonte — todos os campos Genesis disponíveis
    const fonte = {
      nome          : produto.nome || '',
      ean           : b1.ean || '',
      oem           : b1.oem || '',
      sku           : b1.sku || '',
      fabricante    : b1.fabricante || '',
      ncm           : b8.ncm || '',
      ipi           : b8.ipi || '',
      cfop_venda    : b8.cfop_venda || '',
      origem        : b8.origem || '',
      aplicacao     : produto.blocos?.b5?.texto || '',
      imagem_url    : b6.frontal || b6.lateral_d || '',
      seo_title     : b9.title || '',
      seo_desc      : b9.description || '',
      categoria     : b2.categoria || '',
      unidade       : 'PC',
      nct_score     : produto.nct?.score || 0,
      rast_hash     : b1.rast_hash || '',
    };

    // Aplica o mapeamento personalizado
    const destino = {};
    for (const [campo_genesis, campo_destino] of Object.entries(this.mapeamento)) {
      if (fonte[campo_genesis] !== undefined) {
        destino[campo_destino] = fonte[campo_genesis];
      }
    }

    return destino;
  }

  // ============================================================
  // LOG interno do conector
  // ============================================================
  _log(nivel, msg, dados = {}) {
    const entry = { nivel, msg, dados, ts: new Date().toISOString() };
    this.logs.push(entry);
    if (nivel === 'erro') console.error(`[${this.nome}] ${msg}`, dados);
    else console.log(`[${this.nome}] ${msg}`);
    return entry;
  }

  // ============================================================
  // TESTAR conexão — cada conector implementa
  // ============================================================
  async testar() {
    throw new Error(`${this.nome}: testar() não implementado`);
  }

  // ============================================================
  // ENVIAR produto — cada conector implementa
  // ============================================================
  async enviarProduto(produto) {
    throw new Error(`${this.nome}: enviarProduto() não implementado`);
  }

  // ============================================================
  // SINCRONIZAR lote de produtos
  // ============================================================
  async sincronizarLote(produtos = []) {
    const resultados = [];
    this._log('info', `Iniciando lote de ${produtos.length} produtos`);

    for (const produto of produtos) {
      try {
        const r = await this.enviarProduto(produto);
        resultados.push({ ok: true, sku: produto.blocos?.b1?.sku, resultado: r });
      } catch (e) {
        resultados.push({ ok: false, sku: produto.blocos?.b1?.sku, erro: e.message });
      }
      // Delay para não sobrecarregar a API destino
      await new Promise(r => setTimeout(r, 800));
    }

    const ok    = resultados.filter(r => r.ok).length;
    const erros = resultados.filter(r => !r.ok).length;
    this._log('info', `Lote finalizado: ${ok} ok · ${erros} erros`);
    return { ok, erros, resultados };
  }

  // ============================================================
  // SALVAR configuração do conector (persistência)
  // ============================================================
  salvarConfig() {
    ConfigStore.set(this.clienteId, this.nome, {
      tipo       : this.tipo,
      destino    : this.destino,
      intervalo  : this.intervalo,
      mapeamento : this.mapeamento,
      credenciais: this.creds,
    });
    this._log('info', 'Configuração salva');
  }

  // ============================================================
  // RETORNAR logs do conector
  // ============================================================
  getLogs() { return this.logs; }
}

// ============================================================
// CONECTOR PERSONALIZADO (Enterprise)
// O logista define URL, método, headers, mapeamento
// Funciona com qualquer sistema que tenha API REST
// ============================================================
class ConectorCustom extends ConectorBase {
  /**
   * @param {Object} config
   * @param {string} config.url_base    — URL base da API ex: https://meusis.com/api
   * @param {string} config.metodo      — 'POST' | 'PUT' | 'PATCH'
   * @param {string} config.endpoint    — endpoint ex: /produtos
   * @param {Object} config.headers     — headers fixos ex: { Authorization: 'Bearer ...' }
   * @param {string} config.auth_tipo   — 'bearer' | 'apikey' | 'basic' | 'none'
   * @param {string} config.auth_valor  — token/chave
   * @param {Object} config.mapeamento  — { campo_genesis: 'campo_sistema', ... }
   */
  constructor(config = {}) {
    super({ ...config, tipo: 'custom' });
    this.url_base   = config.url_base   || '';
    this.metodo     = config.metodo     || 'POST';
    this.endpoint   = config.endpoint   || '/produtos';
    this.headers_ex = config.headers    || {};
    this.auth_tipo  = config.auth_tipo  || 'none';
    this.auth_valor = config.auth_valor || '';
  }

  _headers() {
    const h = { 'Content-Type': 'application/json', ...this.headers_ex };
    if (this.auth_tipo === 'bearer') h['Authorization'] = `Bearer ${this.auth_valor}`;
    if (this.auth_tipo === 'apikey') h['X-API-Key']     = this.auth_valor;
    if (this.auth_tipo === 'basic') {
      const [u, p] = this.auth_valor.split(':');
      h['Authorization'] = 'Basic ' + Buffer.from(`${u}:${p}`).toString('base64');
    }
    return h;
  }

  async testar() {
    try {
      const r = await axios.get(this.url_base + this.endpoint, { headers: this._headers(), timeout: this.timeout });
      return { ok: true, status: r.status };
    } catch (e) {
      return { ok: false, erro: e.message };
    }
  }

  async enviarProduto(produto) {
    const corpo = this.mapear(produto);
    try {
      const r = await axios({
        method  : this.metodo,
        url     : this.url_base + this.endpoint,
        headers : this._headers(),
        data    : corpo,
        timeout : this.timeout,
      });
      this._log('info', `Enviado: ${corpo.nome || corpo.sku}`, { status: r.status });
      return { ok: true, status: r.status, resposta: r.data };
    } catch (e) {
      this._log('erro', `Falha ao enviar`, { erro: e.message, corpo });
      throw e;
    }
  }
}

// ============================================================
// CONECTOR SCRAPER — raspa catálogo de fornecedor / site
// ============================================================
class ConectorScraper extends ConectorBase {
  /**
   * @param {Object} config
   * @param {string} config.url_catalogo  — URL do catálogo do fornecedor
   * @param {number} config.intervalo_h   — intervalo em horas (padrão 24h)
   * @param {Object} config.seletores     — seletores CSS para extração
   *   ex: { nome: '.product-title', preco: '.price', oem: '.ref', imagem: 'img.main' }
   */
  constructor(config = {}) {
    super({ ...config, tipo: 'scraper' });
    this.url_catalogo = config.url_catalogo || '';
    this.seletores    = config.seletores    || {
      nome   : 'h1, .product-title, .nome-produto',
      preco  : '.price, .preco, [class*="price"]',
      oem    : '.ref, .codigo, .sku, [class*="ref"]',
      ean    : '[class*="ean"], [class*="barcode"]',
      imagem : 'img.main, .product-image img, .foto-produto',
    };
  }

  async raspar(url = '') {
    const alvo = url || this.url_catalogo;
    if (!alvo) throw new Error('URL do catálogo não informada');

    this._log('info', `Raspando: ${alvo}`);

    try {
      // Busca HTML da página com User-Agent de browser
      const r = await axios.get(alvo, {
        timeout : this.timeout,
        headers : {
          'User-Agent'     : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'pt-BR,pt;q=0.9',
          'Accept'         : 'text/html,application/xhtml+xml',
        },
      });

      // Extração básica por regex (sem cheerio para manter dependência zero)
      const html = r.data;
      const extrair = (padrao) => {
        const m = html.match(padrao);
        return m ? m[1]?.trim() : '';
      };

      const produto = {
        nome  : extrair(/<title[^>]*>([^<]+)<\/title>/i)
               || extrair(/og:title.*?content="([^"]+)"/i) || '',
        preco : extrair(/class="[^"]*price[^"]*"[^>]*>\s*R?\$?\s*([\d.,]+)/i) || '',
        oem   : extrair(/class="[^"]*ref[^"]*"[^>]*>([^<]+)/i)
               || extrair(/class="[^"]*sku[^"]*"[^>]*>([^<]+)/i) || '',
        imagem: extrair(/og:image.*?content="([^"]+)"/i)
               || extrair(/<img[^>]+src="([^"]+)"[^>]*class="[^"]*main[^"]*"/i) || '',
        url   : alvo,
        raspado_em: new Date().toISOString(),
      };

      this._log('info', `Raspado: ${produto.nome || alvo}`);
      return produto;

    } catch (e) {
      this._log('erro', `Falha ao raspar ${alvo}`, { erro: e.message });
      throw e;
    }
  }

  // Raspa lista de URLs (catálogo com múltiplos produtos)
  async rasparLista(urls = []) {
    const resultados = [];
    for (const url of urls) {
      try {
        resultados.push(await this.raspar(url));
        await new Promise(r => setTimeout(r, 2000)); // 2s entre raspagens — não sobrecarregar
      } catch (e) {
        resultados.push({ url, erro: e.message });
      }
    }
    return resultados;
  }

  async enviarProduto(produto) {
    // Para scrapers, "enviar" significa raspar e retornar os dados
    return await this.raspar(produto.url || '');
  }
}

// ============================================================
// CONECTOR WHATSAPP — link pré-preenchido
// ============================================================
class ConectorWhatsApp extends ConectorBase {
  /**
   * @param {Object} config
   * @param {string} config.numero    — ex: '5562991654515'
   * @param {string} config.template  — template com variáveis {nome} {oem} {aplicacao}
   */
  constructor(config = {}) {
    super({ ...config, tipo: 'whatsapp' });
    this.numero   = (config.numero || '5562991654515').replace(/\D/g, '');
    this.template = config.template || `Olá! Tenho interesse no produto:
*{nome}*
OEM: {oem}
Aplicação: {aplicacao}
EAN: {ean}
Código: {sku}

Qual o preço e disponibilidade?`;
  }

  // Gera o link do WhatsApp para um produto
  gerarLink(produto) {
    const b1 = produto.blocos?.b1 || {};
    const b5 = produto.blocos?.b5 || {};

    const mensagem = this.template
      .replace('{nome}',      produto.nome || '')
      .replace('{oem}',       b1.oem || '—')
      .replace('{ean}',       b1.ean || '—')
      .replace('{sku}',       b1.sku || '—')
      .replace('{aplicacao}', b5.texto?.substring(0, 80) || '—')
      .replace('{fabricante}',b1.fabricante || '—');

    const encoded = encodeURIComponent(mensagem);
    return `https://wa.me/${this.numero}?text=${encoded}`;
  }

  // Gera botão HTML para o catálogo
  gerarBotaoHTML(produto) {
    const link = this.gerarLink(produto);
    return `<a href="${link}" target="_blank" 
      style="display:inline-flex;align-items:center;gap:8px;padding:10px 20px;
             background:#25D366;color:white;border-radius:8px;
             text-decoration:none;font-weight:500;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
        <path d="M12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.304-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413A11.824 11.824 0 0012.05 0z"/>
      </svg>
      Consultar no WhatsApp
    </a>`;
  }

  async enviarProduto(produto) {
    const link = this.gerarLink(produto);
    this._log('info', `Link WhatsApp gerado: ${produto.nome}`);
    return { ok: true, link, numero: this.numero };
  }
}

// ============================================================
// GERENCIADOR DE CONECTORES
// O logista cria, salva e ativa conectores por aqui
// ============================================================
class GerenciadorConectores {
  constructor(clienteId) {
    this.clienteId  = clienteId;
    this.ativos     = {};
    this._carregar();
  }

  _carregar() {
    const lista = ConfigStore.listar(this.clienteId);
    lista.forEach(c => {
      if (c.ativo) {
        const conf = ConfigStore.get(this.clienteId, c.nome);
        this.ativos[c.nome] = this._instanciar(conf);
      }
    });
  }

  _instanciar(conf) {
    switch (conf.tipo) {
      case 'scraper'   : return new ConectorScraper(conf);
      case 'whatsapp'  : return new ConectorWhatsApp(conf);
      case 'custom'    : return new ConectorCustom(conf);
      default          : return new ConectorCustom(conf);
    }
  }

  // Adiciona novo conector personalizado
  adicionar(nome, tipo, opcoes = {}) {
    const conf = { nome, tipo, clienteId: this.clienteId, ...opcoes };
    ConfigStore.set(this.clienteId, nome, conf);
    this.ativos[nome] = this._instanciar(conf);
    console.log(`[Gerenciador] Conector "${nome}" adicionado`);
    return this.ativos[nome];
  }

  // Lista todos os conectores do cliente
  listar() { return ConfigStore.listar(this.clienteId); }

  // Envia produto para TODOS os conectores ativos
  async broadcast(produto) {
    const resultados = {};
    for (const [nome, conector] of Object.entries(this.ativos)) {
      try {
        resultados[nome] = await conector.enviarProduto(produto);
      } catch (e) {
        resultados[nome] = { ok: false, erro: e.message };
      }
    }
    return resultados;
  }

  // Testa todos os conectores
  async testarTodos() {
    const resultados = {};
    for (const [nome, conector] of Object.entries(this.ativos)) {
      resultados[nome] = await conector.testar().catch(e => ({ ok: false, erro: e.message }));
    }
    return resultados;
  }
}

// ============================================================
// ROTAS EXPRESS — Aba de Conectores
// ============================================================
function registrarRotas(app) {

  function auth(req, res) {
    const token = req.headers['x-genesis-token'];
    if (!token) { res.status(401).json({ ok: false, erro: 'Token obrigatório' }); return false; }
    return true;
  }

  // Listar conectores do cliente
  app.get('/api/conectores', (req, res) => {
    if (!auth(req, res)) return;
    const clienteId = req.query.clienteId || req.headers['x-cliente-id'];
    const lista = ConfigStore.listar(clienteId);
    return res.json({ ok: true, conectores: lista });
  });

  // Criar / atualizar conector personalizado
  app.post('/api/conectores', (req, res) => {
    if (!auth(req, res)) return;
    const { clienteId, nome, tipo, opcoes } = req.body;
    if (!clienteId || !nome || !tipo)
      return res.status(400).json({ ok: false, erro: 'clienteId, nome e tipo obrigatórios' });

    ConfigStore.set(clienteId, nome, { tipo, clienteId, nome, ...opcoes });
    return res.json({ ok: true, msg: `Conector "${nome}" salvo` });
  });

  // Testar conector
  app.post('/api/conectores/testar', async (req, res) => {
    if (!auth(req, res)) return;
    const { clienteId, nome } = req.body;
    const conf = ConfigStore.get(clienteId, nome);
    if (!conf) return res.status(404).json({ ok: false, erro: 'Conector não encontrado' });

    let conector;
    switch (conf.tipo) {
      case 'scraper'  : conector = new ConectorScraper(conf);   break;
      case 'whatsapp' : conector = new ConectorWhatsApp(conf);  break;
      default         : conector = new ConectorCustom(conf);    break;
    }

    const resultado = await conector.testar().catch(e => ({ ok: false, erro: e.message }));
    return res.json({ ok: resultado.ok, detalhes: resultado });
  });

  // Gerar link WhatsApp de um produto
  app.post('/api/conectores/whatsapp/link', (req, res) => {
    const { numero, produto } = req.body;
    const c = new ConectorWhatsApp({ numero });
    return res.json({ ok: true, link: c.gerarLink(produto), botao: c.gerarBotaoHTML(produto) });
  });

  // Raspar URL de catálogo
  app.post('/api/conectores/scraper/raspar', async (req, res) => {
    if (!auth(req, res)) return;
    const { url, seletores } = req.body;
    if (!url) return res.status(400).json({ ok: false, erro: 'URL obrigatória' });

    const c = new ConectorScraper({ url_catalogo: url, seletores });
    try {
      const dados = await c.raspar(url);
      return res.json({ ok: true, dados });
    } catch (e) {
      return res.status(500).json({ ok: false, erro: e.message });
    }
  });
}

// ============================================================
// EXPORTS
// ============================================================
module.exports = {
  ConectorBase,
  ConectorCustom,
  ConectorScraper,
  ConectorWhatsApp,
  GerenciadorConectores,
  ConfigStore,
  registrarRotas,
};

// ============================================================
// TESTE DIRETO: node conector-base.js
// ============================================================
if (require.main === module) {
  console.log('\n=== Genesis iRollo 360 · Conectores Personalizados ===\n');

  const clienteId = '12345678000100'; // CNPJ do cliente

  // Instância do gerenciador
  const gerenciador = new GerenciadorConectores(clienteId);

  // Exemplo: adicionar conector WhatsApp personalizado
  gerenciador.adicionar('WhatsApp MOBIS', 'whatsapp', {
    numero  : '5562991654515',
    template: `Olá! Interesse em:\n*{nome}*\nOEM: {oem}\nAplicação: {aplicacao}\nCódigo: {sku}`,
  });

  // Exemplo: adicionar conector scraper de fornecedor
  gerenciador.adicionar('Catálogo Bosch', 'scraper', {
    url_catalogo: 'https://www.bosch-automotive.com/pt/parts/catalog',
    intervalo_h : 24,
  });

  // Exemplo: conector enterprise personalizado
  gerenciador.adicionar('Sistema Interno', 'custom', {
    url_base   : 'https://meu-sistema.com',
    endpoint   : '/api/produtos',
    metodo     : 'POST',
    auth_tipo  : 'bearer',
    auth_valor : 'meu-token-secreto',
    mapeamento : {
      nome       : 'product_name',
      ean        : 'barcode',
      oem        : 'ref_code',
      aplicacao  : 'vehicle_fit',
      imagem_url : 'image_1',
      ncm        : 'fiscal_code',
    },
  });

  console.log('Conectores configurados:');
  gerenciador.listar().forEach(c => console.log(`  - ${c.nome} (${c.tipo})`));

  // Teste link WhatsApp
  const wz = new ConectorWhatsApp({ numero: '5562991654515' });
  const produtoTeste = {
    nome: 'Motor Arranque Bosch 1986S00925',
    blocos: {
      b1: { ean: '4047026608724', oem: '3610042200', sku: '1986S00925' },
      b5: { texto: 'Hyundai Galloper I/II · Mitsubishi L200' },
    },
  };
  console.log('\nLink WhatsApp gerado:');
  console.log(wz.gerarLink(produtoTeste));
}
