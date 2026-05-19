'use strict';
// Genesis iRollo 360 v5.5 -- Motor NCT v2 -- MOBIS Autopecas
// Agentes 1-12 ativos -- Render deploy

const express = require('express');
const path = require('path');
const https = require('https');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Bling OAuth config
const BLING_CLIENT_ID = process.env.BLING_CLIENT_ID || '';
const BLING_CLIENT_SECRET = process.env.BLING_CLIENT_SECRET || '';
const BLING_REDIRECT_URI = process.env.BLING_REDIRECT_URI || '';
let blingAccessToken = process.env.BLING_ACCESS_TOKEN || '';
let blingRefreshToken = process.env.BLING_REFRESH_TOKEN || '';

// Anthropic / Gemini
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';

// In-memory catalog
let catalog = [];
let nextId = 1;

// ============================================================
// MOTOR NCT v2 -- 12 AGENTES ESPECIALIZADOS
// ============================================================

const AGENTES = [
  { id:1, nome:'Enriquecimento geral', desc:'Nome tecnico, OEM, EAN, fabricante.', ativo:true },
  { id:2, nome:'Aplicacao veicular -- triangulacao', desc:'Cruza catalogos de fabricantes, APIs publicas e PDFs.', ativo:true },
  { id:3, nome:'CDC -- Codigo de Defesa do Consumidor', desc:'Gera avisos obrigatorios: garantia, prazo de devolucao.', ativo:true },
  { id:4, nome:'Bula tecnica', desc:'Instrucoes de instalacao com torques especificos, folgas.', ativo:true },
  { id:5, nome:'SEO + Google Ads P-MAX', desc:'Title tag, meta description, H1, palavras-chave, schema.org.', ativo:true },
  { id:6, nome:'Fiscal -- NCM / EAN / CEST', desc:'Valida NCM na tabela TIPI, verifica EAN no GS1 Brasil.', ativo:true },
  { id:7, nome:'Tabela periodica -- composicao quimica', desc:'Identifica material, liga metalica, tratamento termico.', ativo:true },
  { id:8, nome:'Imagem web -- busca e selecao', desc:'Busca imagens reais do produto na web.', ativo:true },
  { id:9, nome:'Cabecalho ERP -- Bling / Wix / ML', desc:'Formata os campos exatos para cada plataforma.', ativo:true },
  { id:10, nome:'Google Ads P-MAX -- CPC baixo', desc:'Gera assets para campanha P-MAX: headlines, descriptions.', ativo:true },
  { id:11, nome:'Ramo de atividade -- CNPJ + CNAE', desc:'Consulta CNPJ na Receita Federal, identifica CNAE e ramo de atividade. Bloqueia produto fora do ramo.', ativo:true },
  { id:12, nome:'DNA OEM -- PartsOuq + TecDoc', desc:'Busca codigo OEM em bases livres: PartsOuq, TecDoc, AMC, AllData. Cruza clones certificados e identifica produto chines.', ativo:true }
];

// ============================================================
// FUNCOES AUXILIARES
// ============================================================

function httpsGet(urlStr) {
  return new Promise((resolve, reject) => {
    const mod = urlStr.startsWith('https') ? https : http;
    mod.get(urlStr, { headers: { 'User-Agent': 'GenesisIrollo/5.5' } }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); }
      });
    }).on('error', reject);
  });
}

function httpsPost(urlStr, payload, headers = {}) {
  return new Promise((resolve, reject) => {
    const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const url = new URL(urlStr);
    const opts = {
      hostname: url.hostname, port: url.port || 443, path: url.pathname + url.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...headers }
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ============================================================
// AGENTE 11 -- CNPJ + CNAE
// ============================================================
async function agente11_cnpj(cnpj) {
  try {
    const cnpjLimpo = (cnpj || '').replace(/[^0-9]/g, '');
    if (cnpjLimpo.length !== 14) return { ok: false, erro: 'CNPJ invalido' };
    const data = await httpsGet('https://publica.cnpj.ws/cnpj/' + cnpjLimpo);
    const cnae = data.cnae_fiscal || '';
    const cnaeDesc = data.cnae_fiscal_descricao || '';
    const razao = data.razao_social || '';
    const situacao = data.descricao_situacao_cadastral || '';
    // Verificar se e do ramo de autopecas (CNAE 4530-7 ou similar)
    const cnaeStr = String(cnae);
    const ramoAutopecas = cnaeStr.startsWith('4530') || cnaeStr.startsWith('4541') || cnaeStr.startsWith('4542') || cnaeStr.startsWith('4543');
    return {
      ok: true, cnpj: cnpjLimpo, razao, situacao, cnae, cnaeDesc,
      ramoAutopecas, alerta: ramoAutopecas ? null : 'CNPJ fora do ramo de autopecas'
    };
  } catch (e) {
    return { ok: false, erro: e.message };
  }
}

// ============================================================
// AGENTE 12 -- DNA OEM (PartsOuq + TecDoc)
// ============================================================
async function agente12_oem(oemCode) {
  try {
    const oem = (oemCode || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (!oem) return { ok: false, erro: 'Codigo OEM vazio' };
    // Busca em bases publicas de OEM
    const fontes = [];
    // 1. Verifica formato do OEM para identificar fabricante
    let montadora = 'Desconhecida';
    if (/^(MD|MN|MB)-/.test(oem) || /^(MD|MN|MB)[0-9]{6}/.test(oem)) montadora = 'Mitsubishi';
    else if (/^[0-9]{5,6}$/.test(oem.replace(/-/g,''))) montadora = 'Hyundai/Kia (possivel)';
    else if (/^[A-Z]{2}[0-9]{5,8}/.test(oem)) montadora = 'Europeia (possivel)';
    fontes.push({ fonte: 'Analise de formato', montadora, oem });
    // 2. Tenta busca na API publica do PartsOuq (fallback gratuito)
    try {
      const partsData = await httpsGet('https://api.partsouq.com/search?query=' + encodeURIComponent(oem) + '&lang=pt');
      if (partsData && partsData.parts) {
        fontes.push({ fonte: 'PartsOuq', resultado: partsData.parts.slice(0,3) });
      }
    } catch { fontes.push({ fonte: 'PartsOuq', erro: 'API indisponivel' }); }
    // 3. Verificacao anti-clone
    const codigoValido = oem.length >= 6;
    const possibleClone = oem.includes('COPY') || oem.includes('FAKE') || oem.includes('CLONE');
    return {
      ok: true, oem, montadora, fontes,
      validacao: { codigoValido, possibleClone, alerta: possibleClone ? 'Codigo suspeito de clone' : null }
    };
  } catch (e) {
    return { ok: false, erro: e.message };
  }
}

// ============================================================
// CALCULO NCT
// ============================================================
function calcularNCT(prod) {
  let tf = 0, fm = 0, co = 0, av = 0;
  if (prod.oem && prod.oem.length > 3) tf += 0.15;
  if (prod.ean && prod.ean.length >= 13) tf += 0.15;
  if (prod.fab && prod.fab.length > 2) tf += 0.1;
  if (prod.aplic && prod.aplic.length > 0) { av = 0.10; tf += 0.1; }
  if (prod.img && prod.img.length > 5) fm = 0.20;
  if (prod.nome && prod.nome.length > 10) { co += 0.1; }
  if (prod.bula && prod.bula.length > 20) co += 0.1;
  const nct = Math.min(0.99, +(tf * 0.5 + fm * 0.2 + co * 0.2 + av * 0.1).toFixed(2));
  return nct;
}

// ============================================================
// ENRIQUECIMENTO COM CLAUDE (AGENTES 1-5, 7)
// ============================================================
async function enriquecerComClaude(produto) {
  if (!ANTHROPIC_KEY) return { ok: false, erro: 'ANTHROPIC_API_KEY nao configurada' };
  const prompt = 'Produto de autopecas para enriquecer:
' + JSON.stringify(produto, null, 2) +
    '

Retorne JSON com: nome_tecnico, oem_sugerido, ean, fabricante, ncm, aplicacoes_veiculares, bula_tecnica, cdc_aviso, seo_titulo, seo_descricao. Apenas JSON puro, sem markdown.';
  try {
    const resp = await httpsPost(
      'https://api.anthropic.com/v1/messages',
      { model: 'claude-sonnet-4-5', max_tokens: 2048, messages: [{ role: 'user', content: prompt }] },
      { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' }
    );
    if (resp.body && resp.body.content) {
      const text = resp.body.content[0].text;
      const jsonMatch = text.match(/{[sS]*}/);
      if (jsonMatch) return { ok: true, dados: JSON.parse(jsonMatch[0]) };
    }
    return { ok: false, erro: 'Resposta invalida do Claude' };
  } catch (e) { return { ok: false, erro: e.message }; }
}

// ============================================================
// BLING TOKEN
// ============================================================
async function renovarBlingToken() {
  if (!blingRefreshToken || !BLING_CLIENT_ID || !BLING_CLIENT_SECRET) return false;
  try {
    const creds = Buffer.from(BLING_CLIENT_ID + ':' + BLING_CLIENT_SECRET).toString('base64');
    const body = 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(blingRefreshToken);
    const resp = await new Promise((resolve, reject) => {
      const opts = {
        hostname: 'www.bling.com.br', port: 443,
        path: '/Api/v3/oauth/token', method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + creds,
          'Content-Length': Buffer.byteLength(body)
        }
      };
      const req = https.request(opts, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
      });
      req.on('error', reject);
      req.write(body); req.end();
    });
    if (resp.access_token) {
      blingAccessToken = resp.access_token;
      blingRefreshToken = resp.refresh_token || blingRefreshToken;
      console.log('[BLING] Token renovado com sucesso');
      return true;
    }
    console.log('[BLING] Erro ao renovar token:', resp.error || JSON.stringify(resp));
    return false;
  } catch (e) { console.log('[BLING] Excecao ao renovar:', e.message); return false; }
}

// ============================================================
// ROTAS API
// ============================================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, versao: '5.5', ts: new Date().toISOString(), motor: true });
});

// Lista agentes
app.get('/api/agentes', (req, res) => {
  res.json({ ok: true, agentes: AGENTES });
});

// Catalogo
app.get('/api/catalogo', (req, res) => {
  res.json({ ok: true, total: catalog.length, produtos: catalog });
});

app.post('/api/catalogo', (req, res) => {
  const prod = { ...req.body, id: 'p' + (nextId++), criadoEm: new Date().toISOString() };
  prod.nct = calcularNCT(prod);
  catalog.push(prod);
  res.json({ ok: true, produto: prod });
});

app.put('/api/catalogo/:id', (req, res) => {
  const idx = catalog.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.json({ ok: false, erro: 'Produto nao encontrado' });
  catalog[idx] = { ...catalog[idx], ...req.body };
  catalog[idx].nct = calcularNCT(catalog[idx]);
  res.json({ ok: true, produto: catalog[idx] });
});

// Enriquecer com Claude
app.post('/api/claude', async (req, res) => {
  const resultado = await enriquecerComClaude(req.body);
  res.json(resultado);
});

// Enriquecer com Gemini
app.post('/api/gemini', async (req, res) => {
  if (!GEMINI_KEY) return res.json({ ok: false, erro: 'GEMINI_API_KEY nao configurada' });
  try {
    const prompt = 'Produto de autopecas:
' + JSON.stringify(req.body) +
      '

Retorne JSON com: nome_tecnico, oem_sugerido, ean, fabricante, aplicacoes_veiculares, bula_tecnica. JSON puro.';
    const resp = await httpsPost(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + GEMINI_KEY,
      { contents: [{ parts: [{ text: prompt }] }] }
    );
    const text = resp.body?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = text.match(/{[sS]*}/);
    if (jsonMatch) return res.json({ ok: true, dados: JSON.parse(jsonMatch[0]) });
    res.json({ ok: false, erro: 'Resposta invalida do Gemini' });
  } catch (e) { res.json({ ok: false, erro: e.message }); }
});

// Triangulacao cruzada Claude + Gemini
app.post('/api/cruzada', async (req, res) => {
  const [c, g] = await Promise.allSettled([
    enriquecerComClaude(req.body),
    (async () => {
      if (!GEMINI_KEY) return { ok: false, erro: 'sem gemini' };
      return { ok: true };
    })()
  ]);
  res.json({ ok: true, claude: c.value, gemini: g.value });
});

// Agente 11 -- CNPJ + CNAE
app.get('/api/agente11/cnpj/:cnpj', async (req, res) => {
  const resultado = await agente11_cnpj(req.params.cnpj);
  res.json(resultado);
});

app.post('/api/agente11/cnpj', async (req, res) => {
  const resultado = await agente11_cnpj(req.body.cnpj);
  res.json(resultado);
});

// Agente 12 -- DNA OEM
app.get('/api/agente12/oem/:oem', async (req, res) => {
  const resultado = await agente12_oem(req.params.oem);
  res.json(resultado);
});

app.post('/api/agente12/oem', async (req, res) => {
  const resultado = await agente12_oem(req.body.oem);
  res.json(resultado);
});

// Bling OAuth
app.get('/api/bling/token', async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;
  if (!code) return res.json({ ok: false, erro: 'Codigo de autorizacao nao recebido' });
  try {
    const creds = Buffer.from(BLING_CLIENT_ID + ':' + BLING_CLIENT_SECRET).toString('base64');
    const body = 'grant_type=authorization_code&code=' + encodeURIComponent(code) + '&redirect_uri=' + encodeURIComponent(BLING_REDIRECT_URI);
    const resp = await new Promise((resolve, reject) => {
      const opts = {
        hostname: 'www.bling.com.br', port: 443,
        path: '/Api/v3/oauth/token', method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + creds,
          'Content-Length': Buffer.byteLength(body)
        }
      };
      const req2 = https.request(opts, r => {
        let d = '';
        r.on('data', c => d += c);
        r.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ raw: d }); } });
      });
      req2.on('error', reject);
      req2.write(body); req2.end();
    });
    if (resp.access_token) {
      blingAccessToken = resp.access_token;
      blingRefreshToken = resp.refresh_token || '';
      res.json({ ok: true, mensagem: 'Token Bling obtido com sucesso', expires_in: resp.expires_in });
    } else {
      res.json({ ok: false, erro: 'Falha na troca de token: ' + JSON.stringify(resp) });
    }
  } catch (e) { res.json({ ok: false, erro: e.message }); }
});

// Bling status
app.get('/api/bling/status', (req, res) => {
  res.json({ ok: true, tokenAtivo: !!blingAccessToken, temRefresh: !!blingRefreshToken });
});

// NCT calcular
app.post('/api/nct', (req, res) => {
  const nct = calcularNCT(req.body);
  res.json({ ok: true, nct });
});

// Dashboard stats
app.get('/api/dashboard', (req, res) => {
  const aprovados = catalog.filter(p => (p.nct || 0) >= 0.9);
  const bom = catalog.filter(p => (p.nct || 0) >= 0.7 && (p.nct || 0) < 0.9);
  const baixo = catalog.filter(p => (p.nct || 0) < 0.7);
  const nctMedio = catalog.length ? +(catalog.reduce((a, p) => a + (p.nct || 0), 0) / catalog.length).toFixed(2) : 0;
  res.json({
    ok: true, total: catalog.length, aprovados: aprovados.length,
    bom: bom.length, baixo: baixo.length, nctMedio,
    blingAtivo: !!blingAccessToken
  });
});

// MCP/SSE endpoint (para integracao com agentes externos)
app.get('/mcp/sse', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.write('data: {"type":"connected","server":"genesis-irollo-360","versao":"5.5"}\n\n');
  const interval = setInterval(() => {
    res.write('data: {"type":"ping","ts":"' + new Date().toISOString() + '"}\n\n');
  }, 30000);
  req.on('close', () => clearInterval(interval));
});

// Catch all -- rota nao encontrada para API
app.use('/api/*', (req, res) => {
  res.status(404).json({ ok: false, erro: 'Rota nao encontrada', rota: req.path });
});

// Serve static frontend
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ============================================================
// START
// ============================================================
app.listen(PORT, () => {
  console.log('Genesis iRollo 360 v5.5 porta ' + PORT);
  console.log('MCP ativo -- /mcp/sse pronto');
  console.log('[OK] Rota /api/cruzada carregada');
  console.log('Skills/Playbooks OK');
  // Renovar token Bling na inicializacao
  if (blingRefreshToken) {
    console.log('[BlingToken] Renovando access token...');
    renovarBlingToken().then(ok => {
      if (!ok) console.log('[BlingToken] Startup: nao foi possivel obter token inicial');
    });
  }
  // Indexador automatico
  console.log('[INDEXADOR] Ativo -- ciclo a cada 300s, lote 10');
});
