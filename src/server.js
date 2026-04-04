// ============================================================
// GENESIS iROLLO 360 — SERVER PRINCIPAL
// Node.js + Express | MOBIS Peças Automotivas
// Porta: 3001 | http://localhost:3001
// ============================================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// ------------------------------------------------------------
// MIDDLEWARES
// ------------------------------------------------------------
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5500', 'http://127.0.0.1:5500', '*'],
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

// ------------------------------------------------------------
// ROTAS
// ------------------------------------------------------------
const produtosRouter = require('./routes/produtos');
const { motorRouter, blingRouter } = require('./routes/motor');
const massaRouter = require('./routes/massa');
const wixRouter = require('./routes/wix');

app.use('/api/produtos', produtosRouter);
app.use('/api/motor', motorRouter);
app.use('/api/bling', blingRouter);
app.use('/api/massa', massaRouter);
app.use('/api/wix', wixRouter);

// ------------------------------------------------------------
// GET /api — Health check + info do sistema
// ------------------------------------------------------------
app.get('/api', (req, res) => {
  res.json({
    sistema: 'Genesis iRollo 360',
    versao: '3.0.0',
    motor: 'iRollo v3.0',
    empresa: 'MOBIS Peças Automotivas',
    status: 'online',
    timestamp: new Date().toISOString(),
    endpoints: {
      produtos: {
        'GET /api/produtos': 'Listar produtos do Bling',
        'GET /api/produtos/:id': 'Buscar produto por ID',
        'POST /api/produtos': 'Criar produto (Motor NCT + Bling)',
        'PUT /api/produtos/:id': 'Atualizar produto',
        'DELETE /api/produtos/:id': 'Deletar produto',
        'POST /api/produtos/:id/enriquecer': 'Enriquecer com Gemini'
      },
      motor: {
        'POST /api/motor/nct': 'Calcular NCT',
        'POST /api/motor/processar': 'Processar produto completo',
        'POST /api/motor/hash': 'Gerar RAST-HASH',
        'POST /api/motor/enriquecer': 'Enriquecer via Gemini',
        'POST /api/motor/titulo': 'Gerar título SEO Full-Match',
        'POST /api/motor/lote': 'Processar lote'
      },
      bling: {
        'GET /api/bling/status': 'Testar conexão Bling',
        'POST /api/bling/token/renovar': 'Renovar token OAuth2',
        'GET /api/bling/categorias': 'Listar categorias',
        'GET /api/bling/buscar?codigo=X': 'Buscar por código'
      },
      massa: {
        'POST /api/massa/upload': 'Upload CSV/XLSX',
        'POST /api/massa/enviar-bling': 'Enviar lote para Bling',
        'POST /api/massa/enriquecer-lote': 'Enriquecer lote via Gemini'
      }
    }
  });
});

// ------------------------------------------------------------
// GET /* — Serve o frontend HTML
// ------------------------------------------------------------
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 404 para rotas não encontradas
app.use('/api/*', (req, res) => {
  res.status(404).json({ erro: `Rota ${req.path} não encontrada` });
});

// Handler de erros global
app.use((err, req, res, next) => {
  console.error('[ERRO]', err.message);
  res.status(500).json({ erro: err.message });
});

// ------------------------------------------------------------
// START
// ------------------------------------------------------------
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  ⚙️  GENESIS iROLLO 360 — BACKEND ONLINE      ║');
  console.log('║  MOBIS Peças Automotivas                      ║');
  console.log(`║  🌐 http://localhost:${PORT}                    ║`);
  console.log(`║  📋 API: http://localhost:${PORT}/api            ║`);
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
  console.log(`  Motor iRollo v3.0 ativo`);
  console.log(`  Bling API: ${process.env.BLING_BASE_URL}`);
  console.log(`  NCT mínimo: ${process.env.NCT_MINIMO || 0.90}`);
  console.log(`  Marca padrão: ${process.env.MARCA_PADRAO || 'TRIMGO'}`);
  console.log('');
});

module.exports = app;
