/**
 * server.js - v5.0
 * Genesis iRollo 360
 * @copyright 2026 Jose Nunes Junior / MOBIS Pecas
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

try { const { setupMCP } = require('./mcp'); setupMCP(app); } catch (e) { console.warn('[AVISO] mcp:', e.message); }
try { app.use('/api/indexador', require('./indexador')); } catch (e) { console.warn('[AVISO] indexador:', e.message); }

try {
  app.use('/api/cruzada', require('./routes/cruzada'));
  console.log('Rota /api/cruzada OK');
} catch (e) { console.error('[ERRO] cruzada:', e.message, e.stack); }

try {
  const skills = require('./playbooks/genesis-skills');
  app.post('/api/skills/classificar', async (req, res) => { res.json(await skills.classificarProduto(req.body.texto || '')); });
  app.post('/api/skills/ncm', async (req, res) => { res.json(await skills.sugerirNCM(req.body.nome || '')); });
  app.post('/api/skills/anomalia', async (req, res) => { res.json(await skills.detectarAnomalia(req.body)); });
  app.post('/api/skills/compativel', async (req, res) => { res.json(await skills.validarCompatibilidade(req.body.oem || '', req.body.veiculo || '')); });
  app.post('/api/skills/chat', async (req, res) => { res.json(await skills.playbookChatLogista(req.body.mensagem || '', req.body.historico || [])); });
  app.post('/api/skills/playbook/entrada', async (req, res) => { res.json(await skills.playbookEntradaProduto(req.body)); });
  console.log('Skills/Playbooks OK');
} catch (e) { console.warn('[AVISO] skills:', e.message); }

app.post('/api/gemini', (req, res) => {
  const https = require('https');
  const model = (process.env.GEMINI_MODEL || 'gemini-1.5-flash').trim();
  const key = (process.env.GEMINI_API_KEY || '').trim();
  const prompt = req.body.messages?.[0]?.content || req.body.prompt || req.body.text || 'teste';
  const body = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 2000 } });
  const options = { hostname: 'generativelanguage.googleapis.com', path: '/v1beta/models/' + model + ':generateContent?key=' + key, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
  const r = https.request(options, (response) => {
    let data = '';
    response.on('data', chunk => data += chunk);
    response.on('end', () => {
      try { const g = JSON.parse(data); console.error('GEMINI RAW:', JSON.stringify(g).slice(0, 300)); res.json({ content: [{ type: 'text', text: g.candidates?.[0]?.content?.parts?.[0]?.text || '' }] }); }
      catch (e) { res.status(500).json({ error: data }); }
    });
  });
  r.on('error', e => res.status(500).json({ error: e.message }));
  r.write(body); r.end();
});

app.post('/api/claude', (req, res) => {
  const https = require('https');
  const body = JSON.stringify(req.body);
  const options = { hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST', headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01', 'x-api-key': (process.env.ANTHROPIC_API_KEY || '').trim(), 'Content-Length': Buffer.byteLength(body) } };
  const r = https.request(options, (response) => {
    let data = '';
    response.on('data', chunk => data += chunk);
    response.on('end', () => { try { res.json(JSON.parse(data)); } catch (e) { res.status(500).json({ error: data }); } });
  });
  r.on('error', e => res.status(500).json({ error: e.message }));
  r.write(body); r.end();
});

let motorNCT = null; try { motorNCT = require('./motor-triangulacao-v2'); } catch (e) { console.warn('[AVISO]', e.message); }
let conectores = null; try { conectores = require('./conector-base'); } catch (e) { console.warn('[AVISO]', e.message); }
let banner = null; try { banner = require('./banner-gerador'); } catch (e) { console.warn('[AVISO]', e.message); }
let blingToken = null; try { blingToken = require('./bling-auto-token'); } catch (e) { console.warn('[AVISO]', e.message); }

app.get('/', (req, res) => res.json({ sistema: 'Genesis iRollo 360', versao: '5.0', status: 'online' }));
app.get('/api/health', (req, res) => res.json({ ok: true, versao: '5.0', ts: new Date().toISOString(), motor: !!motorNCT }));

if (motorNCT && motorNCT.registrarRotas) motorNCT.registrarRotas(app);
if (conectores && conectores.registrarRotas) conectores.registrarRotas(app);
if (banner && banner.registrarRotas) banner.registrarRotas(app);

app.post('/api/nct/triangular', async (req, res) => {
  if (!motorNCT) return res.status(503).json({ ok: false, erro: 'Motor NCT nao carregado' });
  try { return res.json({ ok: true, ...await motorNCT.triangular(req.body) }); } catch (e) { return res.status(500).json({ ok: false, erro: e.message }); }
});

app.get('/api/bling/token', async (req, res) => {
  if (!blingToken) return res.status(503).json({ ok: false, erro: 'Bling nao carregado' });
  try { return res.json({ ok: true, token: await blingToken.getToken() ? 'ativo' : 'inativo' }); } catch (e) { return res.status(500).json({ ok: false, erro: e.message }); }
});

app.get('/api/bling/status', (req, res) => {
  if (!blingToken) return res.json({ ok: false, status: 'modulo_nao_carregado', autenticado: false });
  const s = blingToken.statusToken();
  return res.json({ ok: s.tem_token && !s.expirado, status: s.tem_token && !s.expirado ? 'online' : 'expirado', autenticado: s.tem_token && !s.expirado });
});

app.post('/api/bling/token/renovar', async (req, res) => {
  if (!blingToken) return res.status(503).json({ ok: false, erro: 'Bling nao carregado' });
  try { return res.json({ ok: true, mensagem: 'Token renovado!', token: await blingToken.renovarToken() ? 'ativo' : 'inativo' }); } catch (e) { return res.status(500).json({ ok: false, erro: e.message }); }
});

try { app.use('/api/produtos', require('./routes/produtos')); } catch (e) { console.warn('[AVISO] produtos:', e.message); }
try { const { motorRouter, blingRouter } = require('./routes/motor'); app.use('/api/motor', motorRouter); app.use('/api/bling', blingRouter); } catch (e) { console.warn('[AVISO] motor:', e.message); }
try { app.use('/api/massa', require('./routes/massa')); } catch (e) { console.warn('[AVISO] massa:', e.message); }
try { app.use('/api/wix', require('./routes/wix')); } catch (e) { console.warn('[AVISO] wix:', e.message); }

app.post('/api/motor/nct', async (req, res) => {
  if (!motorNCT) return res.status(503).json({ ok: false, erro: 'Motor NCT nao carregado' });
  try { return res.json({ ok: true, ...await motorNCT.triangular(req.body) }); } catch (e) { return res.status(500).json({ ok: false, erro: e.message }); }
});

app.get('/api', (req, res) => res.json({ ok: true, versao: '5.0', status: 'online' }));
app.use((req, res) => res.status(404).json({ ok: false, erro: 'Rota nao encontrada', rota: req.originalUrl }));
app.use((err, req, res, next) => { console.error('[Genesis] Erro:', err.message); res.status(500).json({ ok: false, erro: err.message }); });

app.listen(PORT, () => { console.log('Genesis iRollo 360 v5.0 porta ' + PORT); });
module.exports = app;

app.listen(PORT, () => { console.log('Genesis iRollo 360 v5.0 porta ' + PORT); });
module.exports = app;

