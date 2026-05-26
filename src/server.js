// ============================================================
// GENESIS iROLLO 360 – SERVER PRINCIPAL
// Node.js + Express | MOBIS Peças Automotivas
// Porta: 3001 | http://localhost:3001
// ============================================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

// Banco de dados SQLite próprio
const { sessoes: dbSessoes } = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

// -----------------------------------------------------------
// MIDDLEWARES
// -----------------------------------------------------------
const origensPermitidas = (process.env.CORS_ORIGINS || 'http://localhost:3001,http://localhost:3000').split(',');
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origensPermitidas.includes(origin) || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Origem não permitida pelo CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Genesis-Key']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve arquivos estáticos (frontend HTML)
app.use(express.static(path.join(__dirname, '../public')));

// Logger simples
app.use((req, res, next) => {
  const ts = new Date().toISOString().substring(11, 19);
  console.log(`[${ts}] ${req.method} ${req.path}`);
  next();
});

// -----------------------------------------------------------
// AUTENTICAÇÃO – Login server-side (sem credenciais no HTML)
// -----------------------------------------------------------
app.post('/api/auth/login', (req, res) => {
  const { email, senha } = req.body;
  const usuarioOk = process.env.AUTH_USUARIO || 'mobispecas@gmail.com';
  const senhaOk   = process.env.AUTH_SENHA   || 'Mobis@2025!';

  if (!email || !senha) {
    return res.status(400).json({ ok: false, erro: 'E-mail e senha são obrigatórios' });
  }

  if (email.trim().toLowerCase() !== usuarioOk.toLowerCase() || senha !== senhaOk) {
    console.warn(`[AUTH] Tentativa de login inválida: ${email}`);
    return res.status(401).json({ ok: false, erro: 'Credenciais inválidas' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expira = Date.now() + (8 * 60 * 60 * 1000);
  dbSessoes.set.run(token, email, expira);
  dbSessoes.limpar.run(Date.now());

  console.log(`[AUTH] Login OK: ${email}`);
  res.json({ ok: true, token, expira, usuario: email });
});

// Verificar token
app.get('/api/auth/verificar', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const sessao = dbSessoes.get.get(token);
  if (!sessao || sessao.expira < Date.now()) {
    return res.status(401).json({ ok: false, erro: 'Sessão expirada' });
  }
  res.json({ ok: true, usuario: sessao.email });
});

// -----------------------------------------------------------
// ROTAS
// -----------------------------------------------------------
const produtosRouter = require('./routes/produtos');
const { motorRouter, blingRouter } = require('./routes/motor');
const massaRouter = require('./routes/massa');
const wixRouter = require('./routes/wix');
const empresaRouter = require('./routes/empresa');

app.use('/api/produtos', produtosRouter);
app.use('/api/motor', motorRouter);
app.use('/api/bling', blingRouter);
app.use('/api/massa', massaRouter);
app.use('/api/wix', wixRouter);
app.use('/api/empresa', empresaRouter);

// -----------------------------------------------------------
// GET /api – Health check
// -----------------------------------------------------------
app.get('/api', (req, res) => {
  res.json({
    sistema: 'Genesis iRollo 360',
    versao: '3.2.0',
    motor: 'iRollo v3.2',
    empresa: 'MOBIS Peças Automotivas',
    status: 'online',
    banco: 'SQLite (genesis.db)',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.use('/api/*', (req, res) => {
  res.status(404).json({ erro: `Rota ${req.path} não encontrada` });
});

app.use((err, req, res, next) => {
  console.error('[ERRO]', err.message);
  res.status(500).json({ erro: err.message });
});

// -----------------------------------------------------------
// START
// -----------------------------------------------------------
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  GENESIS iROLLO 360 – BACKEND ONLINE             ║');
  console.log('║  MOBIS Peças Automotivas                          ║');
  console.log(`║  http://localhost:${PORT}                            ║`);
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  Motor iRollo v3.2 ativo`);
  console.log(`  Banco: SQLite (genesis.db)`);
  console.log(`  Bling API: ${process.env.BLING_BASE_URL}`);
  console.log(`  NCT mínimo: ${process.env.NCT_MINIMO || 0.90}`);
  console.log(`  Marca padrão: ${process.env.MARCA_PADRAO || 'TRIMGO'}`);
  console.log('');
});

module.exports = app;
