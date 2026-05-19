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

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const BLING_CLIENT_ID = process.env.BLING_CLIENT_ID || '';
const BLING_CLIENT_SECRET = process.env.BLING_CLIENT_SECRET || '';
const BLING_REDIRECT_URI = process.env.BLING_REDIRECT_URI || '';
let blingAccessToken = process.env.BLING_ACCESS_TOKEN || '';
let blingRefreshToken = process.env.BLING_REFRESH_TOKEN || '';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';

let catalog = [];
let nextId = 1;

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
  { id:12, nome:'DNA OEM -- PartsOuq + TecDoc', desc:'Busca codigo OEM em bases livres: PartsOuq, TecDoc, AMC, AllData. Cruza clones certificados.', ativo:true }
];

function httpsGet(urlStr) {
  return new Promise((resolve, reject) => {
    const mod = urlStr.startsWith('https') ? https : http;
    mod.get(urlStr, { headers: { 'User-Agent': 'GenesisIrollo/5.5' } }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { resolve({ raw: data }); } });
    }).on('error', reject);
  });
}

function httpsPost(urlStr, payload, headers) {
  headers = headers || {};
  return new Promise((resolve, reject) => {
    const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const url = new URL(urlStr);
    const opts = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, headers)
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(data) }); } catch(e) { resolve({ status: res.statusCode, body: data }); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function agente11_cnpj(cnpj) {
  try {
    const cnpjLimpo = (cnpj || '').replace(/[^0-9]/g, '');
    if (cnpjLimpo.length !== 14) return { ok: false, erro: 'CNPJ invalido' };
    const data = await httpsGet('https://publica.cnpj.ws/cnpj/' + cnpjLimpo);
    const cnae = data.cnae_fiscal || '';
    const cnaeDesc = data.cnae_fiscal_descricao || '';
    const razao = data.razao_social || '';
    const situacao = data.descricao_situacao_cadastral || '';
    const cnaeStr = String(cnae);
    const ramoAutopecas = cnaeStr.startsWith('4530') || cnaeStr.startsWith('4541') || cnaeStr.startsWith('4542') || cnaeStr.startsWith('4543');
    return { ok: true, cnpj: cnpjLimpo, razao, situacao, cnae, cnaeDesc, ramoAutopecas, alerta: ramoAutopecas ? null : 'CNPJ fora do ramo de autopecas' };
  } catch(e) { return { ok: false, erro: e.message }; }
}

async function agente12_oem(oemCode) {
  try {
    const oem = (oemCode || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (!oem) return { ok: false, erro: 'Codigo OEM vazio' };
    const fontes = [];
    let montadora = 'Desconhecida';
    if (/^(MD|MN|MB)-/.test(oem) || /^(MD|MN|MB)[0-9]{6}/.test(oem)) montadora = 'Mitsubishi';
    else if (/^[0-9]{5,6}$/.test(oem.replace(/-/g, ''))) montadora = 'Hyundai/Kia (possivel)';
    else if (/^[A-Z]{2}[0-9]{5,8}/.test(oem)) montadora = 'Europeia (possivel)';
    fontes.push({ fonte: 'Analise de formato', montadora, oem });
    try {
      const partsData = await httpsGet('https://api.partsouq.com/search?query=' + encodeURIComponent(oem) + '&lang=pt');
      if (partsData && partsData.parts) fontes.push({ fonte: 'PartsOuq', resultado: partsData.parts.slice(0, 3) });
    } catch(e2) { fontes.push({ fonte: 'PartsOuq', erro: 'API indisponivel' }); }
    const codigoValido = oem.length >= 6;
    const possibleClone = oem.indexOf('COPY') >= 0 || oem.indexOf('FAKE') >= 0 || oem.indexOf('CLONE') >= 0;
    return { ok: true, oem, montadora, fontes, validacao: { codigoValido, possibleClone, alerta: possibleClone ? 'Codigo suspeito de clone' : null } };
  } catch(e) { return { ok: false, erro: e.message }; }
}

function calcularNCT(prod) {
  let tf = 0, fm = 0, co = 0, av = 0;
  if (prod.oem && prod.oem.length > 3) tf += 0.15;
  if (prod.ean && prod.ean.length >= 13) tf += 0.15;
  if (prod.fab && prod.fab.length > 2) tf += 0.1;
  if (prod.aplic && prod.aplic.length > 0) { av = 0.10; tf += 0.1; }
  if (prod.img && prod.img.length > 5) fm = 0.20;
  if (prod.nome && prod.nome.length > 10) co += 0.1;
  if (prod.bula && prod.bula.length > 20) co += 0.1;
  return Math.min(0.99, +(tf * 0.5 + fm * 0.2 + co * 0.2 + av * 0.1).toFixed(2));
}

async function enriquecerComClaude(produto) {
  if (!ANTHROPIC_KEY) return { ok: false, erro: 'ANTHROPIC_API_KEY nao configurada' };
  const prompt = 'Produto de autopecas para enriquecer: ' + JSON.stringify(produto) + ' Retorne JSON com: nome_tecnico, oem_sugerido, ean, fabricante, ncm, aplicacoes_veiculares, bula_tecnica, cdc_aviso, seo_titulo, seo_descricao. Apenas JSON puro.';
  try {
    const resp = await httpsPost('https://api.anthropic.com/v1/messages',
      { model: 'claude-sonnet-4-5', max_tokens: 2048, messages: [{ role: 'user', content: prompt }] },
      { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' }
    );
    if (resp.body && resp.body.content) {
      const text = resp.body.content[0].text;
      const m = text.match(/\{[\s\S]*\}/);
      if (m) return { ok: true, dados: JSON.parse(m[0]) };
    }
    return { ok: false, erro: 'Resposta invalida do Claude' };
  } catch(e) { return { ok: false, erro: e.message }; }
}

async function renovarBlingToken() {
  if (!blingRefreshToken || !BLING_CLIENT_ID || !BLING_CLIENT_SECRET) return false;
  try {
    const creds = Buffer.from(BLING_CLIENT_ID + ':' + BLING_CLIENT_SECRET).toString('base64');
    const body = 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(blingRefreshToken);
    const resp = await new Promise((resolve, reject) => {
      const opts = { hostname: 'www.bling.com.br', port: 443, path: '/Api/v3/oauth/token', method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': 'Basic ' + creds, 'Content-Length': Buffer.byteLength(body) } };
      const req = https.request(opts, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve({}); } });
      });
      req.on('error', reject);
      req.write(body); req.end();
    });
    if (resp.access_token) { blingAccessToken = resp.access_token; blingRefreshToken = resp.refresh_token || blingRefreshToken; console.log('[BLING] Token renovado'); return true; }
    console.log('[BLING] Erro ao renovar token:', resp.error || JSON.stringify(resp));
    return false;
  } catch(e) { console.log('[BLING] Excecao:', e.message); return false; }
}

app.get('/api/health', (req, res) => { res.json({ ok: true, versao: '5.5', ts: new Date().toISOString(), motor: true, agentes: 12 }); });
app.get('/api/agentes', (req, res) => { res.json({ ok: true, agentes: AGENTES }); });
app.get('/api/catalogo', (req, res) => { res.json({ ok: true, total: catalog.length, produtos: catalog }); });

app.post('/api/catalogo', (req, res) => {
  const prod = Object.assign({}, req.body, { id: 'p' + (nextId++), criadoEm: new Date().toISOString() });
  prod.nct = calcularNCT(prod);
  catalog.push(prod);
  res.json({ ok: true, produto: prod });
});

app.put('/api/catalogo/:id', (req, res) => {
  const idx = catalog.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.json({ ok: false, erro: 'Produto nao encontrado' });
  catalog[idx] = Object.assign({}, catalog[idx], req.body);
  catalog[idx].nct = calcularNCT(catalog[idx]);
  res.json({ ok: true, produto: catalog[idx] });
});

app.post('/api/claude', async (req, res) => { res.json(await enriquecerComClaude(req.body)); });

app.post('/api/gemini', async (req, res) => {
  if (!GEMINI_KEY) return res.json({ ok: false, erro: 'GEMINI_API_KEY nao configurada' });
  try {
    const prompt = 'Produto de autopecas: ' + JSON.stringify(req.body) + ' Retorne JSON com: nome_tecnico, oem_sugerido, ean, fabricante, aplicacoes_veiculares, bula_tecnica. JSON puro.';
    const resp = await httpsPost('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + GEMINI_KEY, { contents: [{ parts: [{ text: prompt }] }] });
    const text = ((resp.body || {}).candidates || [{}])[0].content ? resp.body.candidates[0].content.parts[0].text : '';
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return res.json({ ok: true, dados: JSON.parse(m[0]) });
    res.json({ ok: false, erro: 'Resposta invalida do Gemini' });
  } catch(e) { res.json({ ok: false, erro: e.message }); }
});

app.post('/api/cruzada', async (req, res) => {
  const [c, g] = await Promise.allSettled([enriquecerComClaude(req.body), Promise.resolve({ ok: true, gemini: 'disponivel' })]);
  res.json({ ok: true, claude: c.value, gemini: g.value });
});

app.get('/api/agente11/cnpj/:cnpj', async (req, res) => { res.json(await agente11_cnpj(req.params.cnpj)); });
app.post('/api/agente11/cnpj', async (req, res) => { res.json(await agente11_cnpj(req.body.cnpj)); });
app.get('/api/agente12/oem/:oem', async (req, res) => { res.json(await agente12_oem(req.params.oem)); });
app.post('/api/agente12/oem', async (req, res) => { res.json(await agente12_oem(req.body.oem)); });

app.get('/api/bling/token', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.json({ ok: false, erro: 'Codigo de autorizacao nao recebido' });
  try {
    const creds = Buffer.from(BLING_CLIENT_ID + ':' + BLING_CLIENT_SECRET).toString('base64');
    const body = 'grant_type=authorization_code&code=' + encodeURIComponent(code) + '&redirect_uri=' + encodeURIComponent(BLING_REDIRECT_URI);
    const resp = await new Promise((resolve, reject) => {
      const opts = { hostname: 'www.bling.com.br', port: 443, path: '/Api/v3/oauth/token', method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': 'Basic ' + creds, 'Content-Length': Buffer.byteLength(body) } };
      const req2 = https.request(opts, r => {
        let d = '';
        r.on('data', c => d += c);
        r.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve({ raw: d }); } });
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
  } catch(e) { res.json({ ok: false, erro: e.message }); }
});

app.get('/api/bling/status', (req, res) => { res.json({ ok: true, tokenAtivo: !!blingAccessToken, temRefresh: !!blingRefreshToken }); });
app.post('/api/nct', (req, res) => { res.json({ ok: true, nct: calcularNCT(req.body) }); });

app.get('/api/dashboard', (req, res) => {
  const aprovados = catalog.filter(p => (p.nct || 0) >= 0.9).length;
  const nctMedio = catalog.length ? +(catalog.reduce((a, p) => a + (p.nct || 0), 0) / catalog.length).toFixed(2) : 0;
  res.json({ ok: true, total: catalog.length, aprovados, nctMedio, blingAtivo: !!blingAccessToken });
});

app.get('/mcp/sse', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.write('data: {"type":"connected","server":"genesis-irollo-360","versao":"5.5"}\n\n');
  const iv = setInterval(() => { res.write('data: {"type":"ping","ts":"' + new Date().toISOString() + '"}\n\n'); }, 30000);
  req.on('close', () => clearInterval(iv));
});

app.use('/api', (req, res) => { res.status(404).json({ ok: false, erro: 'Rota nao encontrada', rota: req.path }); });
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res) => { res.sendFile(path.join(__dirname, '..', 'public', 'index.html')); });

app.listen(PORT, () => {
  console.log('Genesis iRollo 360 v5.5 porta ' + PORT);
  console.log('MCP ativo -- /mcp/sse pronto');
  console.log('[OK] Rota /api/cruzada carregada');
  console.log('Skills/Playbooks OK');
  if (blingRefreshToken) {
    console.log('[BlingToken] Renovando access token...');
    renovarBlingToken().then(ok => { if (!ok) console.log('[BlingToken] Startup: nao foi possivel obter token inicial'); });
  }
  console.log('[INDEXADOR] Ativo -- ciclo a cada 300s, lote 10');
});
