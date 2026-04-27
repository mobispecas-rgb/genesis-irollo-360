/**
 * @copyright 2026 Jose Nunes Junior / MOBIS Pecas
 * @license Proprietario — Todos os direitos reservados
 *
 * server.js — v4.0
 * Genesis iRollo 360 · genesisindexia.com.br
 * Motor NCT by Junior / MOBIS Pecas
 */

require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const path       = require('path');

const app  = express();
const PORT = process.env.PORT || 3001;

// ============================================================
// MIDDLEWARES
// ============================================================
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// ============================================================
// CARREGAR MÓDULOS GENESIS
// ============================================================

// Motor NCT v2 — 10 blocos + NF automático + repositório
let motorNCT = null;
try {
  motorNCT = require('./motor-triangulacao-v2');
  console.log('  Motor NCT v2 carregado');
} catch (e) {
  console.warn('  [AVISO] motor-triangulacao-v2.js nao encontrado:', e.message);
}

// Conectores personalizados
let conectores = null;
try {
  conectores = require('./conector-base');
  console.log('  Conectores carregados');
} catch (e) {
  console.warn('  [AVISO] conector-base.js nao encontrado:', e.message);
}

// Banner gerador
let banner = null;
try {
  banner = require('./banner-gerador');
  console.log('  Banner gerador carregado');
} catch (e) {
  console.warn('  [AVISO] banner-gerador.js nao encontrado:', e.message);
}

// Token Bling
let blingToken = null;
try {
  blingToken = require('./bling-auto-token');
  console.log('  Bling token carregado');
} catch (e) {
  console.warn('  [AVISO] bling-auto-token.js nao encontrado:', e.message);
}

// ============================================================
// ROTA RAIZ — status do sistema
// ============================================================
app.get('/', (req, res) => {
  res.json({
    sistema  : 'Genesis iRollo 360',
    versao   : '4.0',
    titular  : 'Junior / MOBIS Pecas',
    motor    : 'NCT v2 — Motor de Confianca Tecnica',
    status   : 'online',
    modulos  : {
      motor_nct   : !!motorNCT,
      conectores  : !!conectores,
      banner      : !!banner,
      bling_token : !!blingToken,
    },
    endpoints: {
      motor    : '/api/motor/triangular · /api/motor/nf · /api/motor/ncm/:codigo',
      conectores: '/api/conectores · /api/conectores/testar · /api/conectores/whatsapp/link',
      banner   : '/api/banner/gerar · /api/banner/todos',
      bling    : '/api/bling/token · /api/bling/produtos',
      health   : '/api/health',
    },
  });
});

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/api/health', (req, res) => {
  res.json({
    ok      : true,
    versao  : '4.0',
    ts      : new Date().toISOString(),
    modulos : {
      motor_nct   : !!motorNCT,
      conectores  : !!conectores,
      banner      : !!banner,
      bling_token : !!blingToken,
    },
  });
});

// ============================================================
// REGISTRAR ROTAS DOS MÓDULOS
// ============================================================
if (motorNCT?.registrarRotas)   motorNCT.registrarRotas(app);
if (conectores?.registrarRotas) conectores.registrarRotas(app);
if (banner?.registrarRotas)     banner.registrarRotas(app);

// ============================================================
// ROTA LEGADA — compatibilidade com v3.0
// ============================================================
app.post('/api/nct/triangular', async (req, res) => {
  if (!motorNCT) return res.status(503).json({ ok: false, erro: 'Motor NCT nao carregado' });
  try {
    const resultado = await motorNCT.triangular(req.body);
    return res.json({ ok: true, ...resultado });
  } catch (e) {
    return res.status(500).json({ ok: false, erro: e.message });
  }
});

// ============================================================
// BLING — rotas básicas
// ============================================================
app.get('/api/bling/token', async (req, res) => {
  if (!blingToken) return res.status(503).json({ ok: false, erro: 'Bling token nao carregado' });
  try {
    const token = await blingToken.getToken?.();
    return res.json({ ok: true, token: token ? 'ativo' : 'inativo' });
  } catch (e) {
    return res.status(500).json({ ok: false, erro: e.message });
  }
});

// ============================================================
// 404
// ============================================================
app.use((req, res) => {
  res.status(404).json({
    ok    : false,
    erro  : 'Rota nao encontrada',
    rota  : req.originalUrl,
    dica  : 'Consulte / para ver os endpoints disponíveis',
  });
});

// ============================================================
// ERRO GLOBAL
// ============================================================
app.use((err, req, res, next) => {
  console.error('[Genesis] Erro:', err.message);
  res.status(500).json({ ok: false, erro: err.message });
});

// ============================================================
// INICIAR SERVIDOR
// ============================================================
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  GENESIS iRollo 360 — BACKEND v4.0           ║');
  console.log('║  Motor NCT · Junior / MOBIS Pecas            ║');
  console.log(`║  http://localhost:${PORT}                     ║`);
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
  console.log('  Modulos ativos:');
  console.log(`  Motor NCT v2   : ${motorNCT   ? '✅' : '❌'}`);
  console.log(`  Conectores     : ${conectores ? '✅' : '❌'}`);
  console.log(`  Banner gerador : ${banner     ? '✅' : '❌'}`);
  console.log(`  Bling token    : ${blingToken ? '✅' : '❌'}`);
  console.log('');
  console.log('  Endpoints principais:');
  console.log('  POST /api/motor/triangular');
  console.log('  POST /api/motor/nf');
  console.log('  POST /api/banner/gerar');
  console.log('  POST /api/conectores');
  console.log('  GET  /api/health');
  console.log('');
});

module.exports = app;
  
