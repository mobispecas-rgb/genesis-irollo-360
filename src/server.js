/**
 * @copyright 2026 Jose Nunes Junior / MOBIS Pecas
 * @license Proprietario â€” Todos os direitos reservados
 *
 * server.js â€” v4.0
 * Genesis iRollo 360 Â· genesisindexia.com.br
 * Motor NCT by Junior / MOBIS Pecas
 */

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const { setupMCP } = require('./mcp');
setupMCP(app);
app.use('/api/indexador', require('./indexador'));
const PORT = process.env.PORT || 3001;

// ============================================================
// MIDDLEWARES
// ============================================================
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));


// ── PROXY ANTHROPIC API (resolve CORS do browser) ──────────
app.post('/api/claude', async (req, res) => {
  try {
    
    const r = await globalThis.fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': process.env.ANTHROPIC_API_KEY || ''
      },
      body: JSON.stringify(req.body)
    });
    const d = await r.json();
    res.json(d);
  } catch(e) {
    res.status(500).json({error: e.message});
  }
});
// ============================================================
// CARREGAR MÃ“DULOS GENESIS
// ============================================================

// Motor NCT v2
let motorNCT = null;
try {
    motorNCT = require('./motor-triangulacao-v2');
    console.log(' Motor NCT v2 carregado');
} catch (e) {
    console.warn(' [AVISO] motor-triangulacao-v2.js nao encontrado:', e.message);
}

// Conectores personalizados
let conectores = null;
try {
    conectores = require('./conector-base');
    console.log(' Conectores carregados');
} catch (e) {
    console.warn(' [AVISO] conector-base.js nao encontrado:', e.message);
}

// Banner gerador
let banner = null;
try {
    banner = require('./banner-gerador');
    console.log(' Banner gerador carregado');
} catch (e) {
    console.warn(' [AVISO] banner-gerador.js nao encontrado:', e.message);
}

// Token Bling (v4.0 â€” memÃ³ria)
let blingToken = null;
try {
    blingToken = require('./bling-auto-token');
    console.log(' Bling token v4.0 carregado');
} catch (e) {
    console.warn(' [AVISO] bling-auto-token.js nao encontrado:', e.message);
}

// ============================================================
// ROTA RAIZ â€” status do sistema
// ============================================================
app.get('/', (req, res) => {
    res.json({
          sistema  : 'Genesis iRollo 360',
          versao   : '4.0',
          titular  : 'Junior / MOBIS Pecas',
          motor    : 'NCT v2 â€” Motor de Confianca Tecnica',
          status   : 'online',
          modulos  : {
                  motor_nct  : !!motorNCT,
                  conectores : !!conectores,
                  banner     : !!banner,
                  bling_token: !!blingToken,
          },
          endpoints: {
                  motor     : '/api/motor/triangular Â· /api/motor/nf Â· /api/motor/ncm/:codigo',
                  conectores: '/api/conectores Â· /api/conectores/testar Â· /api/conectores/whatsapp/link',
                  banner    : '/api/banner/gerar Â· /api/banner/todos',
                  bling     : '/api/bling/token Â· /api/bling/status Â· /api/bling/token/renovar Â· /api/bling/produtos',
                  health    : '/api/health',
          },
    });
});

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/api/health', (req, res) => {
    res.json({
          ok     : true,
          versao : '4.0',
          ts     : new Date().toISOString(),
          modulos: {
                  motor_nct  : !!motorNCT,
                  conectores : !!conectores,
                  banner     : !!banner,
                  bling_token: !!blingToken,
          },
    });
});

// ============================================================
// REGISTRAR ROTAS DOS MÃ“DULOS
// ============================================================
if (motorNCT?.registrarRotas)  motorNCT.registrarRotas(app);
if (conectores?.registrarRotas) conectores.registrarRotas(app);
if (banner?.registrarRotas)    banner.registrarRotas(app);

// ============================================================
// ROTA LEGADA â€” compatibilidade com v3.0
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
// BLING â€” rotas de token
// ============================================================

// GET /api/bling/token â€” retorna se o token estÃ¡ ativo
app.get('/api/bling/token', async (req, res) => {
    if (!blingToken) return res.status(503).json({ ok: false, erro: 'Bling token nao carregado' });
    try {
          const token = await blingToken.getToken();
          return res.json({ ok: true, token: token ? 'ativo' : 'inativo' });
    } catch (e) {
          return res.status(500).json({ ok: false, erro: e.message });
    }
});

// GET /api/bling/status â€” status detalhado real do token
app.get('/api/bling/status', (req, res) => {
    if (!blingToken) {
          return res.json({ ok: false, status: 'modulo_nao_carregado', autenticado: false });
    }
    const s = blingToken.statusToken();
    return res.json({
          ok        : s.tem_token && !s.expirado,
          status    : s.tem_token && !s.expirado ? 'online' : 'token_expirado_ou_ausente',
          autenticado: s.tem_token && !s.expirado,
          expira_em : s.expira_em,
          credenciais: {
                  client_id    : s.tem_client_id ? 'configurado' : 'AUSENTE',
                  client_secret: s.tem_secret   ? 'configurado' : 'AUSENTE',
                  refresh_token: s.tem_refresh  ? 'configurado' : 'AUSENTE',
          }
    });
});

// POST /api/bling/token/renovar â€” forÃ§a renovaÃ§Ã£o do token
app.post('/api/bling/token/renovar', async (req, res) => {
    if (!blingToken) return res.status(503).json({ ok: false, erro: 'Bling token nao carregado' });
    try {
          const token = await blingToken.renovarToken();
          return res.json({ ok: true, mensagem: 'Token renovado com sucesso!', token: token ? 'ativo' : 'inativo' });
    } catch (e) {
          return res.status(500).json({ ok: false, erro: e.message });
    }
});

// ============================================================
// ROTAS v3 â€” routes/
// ============================================================
const rProdutos = require('./routes/produtos');
const { motorRouter: rMotor, blingRouter: rBling } = require('./routes/motor');
const rMassa    = require('./routes/massa');
const rWix      = require('./routes/wix');

app.use('/api/produtos', rProdutos);
app.use('/api/motor',    rMotor);
app.use('/api/bling',    rBling);
app.use('/api/massa',    rMassa);
app.use('/api/wix',      rWix);

// ROTAS LEGADAS v3
app.post('/api/motor/nct', async (req, res) => {
    if (!motorNCT) return res.status(503).json({ ok: false, erro: 'Motor NCT nao carregado' });
    try {
          const r = await motorNCT.triangular(req.body);
          return res.json({ ok: true, ...r });
    } catch (e) {
          return res.status(500).json({ ok: false, erro: e.message });
    }
});

app.get('/api', (req, res) => {
    res.json({ ok: true, versao: '4.0', status: 'online' });
});

// ============================================================
// 404
// ============================================================
app.use((req, res) => {
    res.status(404).json({
          ok  : false,
          erro: 'Rota nao encontrada',
          rota: req.originalUrl,
          dica: 'Consulte / para ver os endpoints disponÃ­veis',
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
    console.log('â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—');
    console.log('â•‘  GENESIS iRollo 360 â€” BACKEND v4.0          â•‘');
    console.log('â•‘  Motor NCT Â· Junior / MOBIS Pecas           â•‘');
    console.log(`â•‘  http://localhost:${PORT}                    â•‘`);
    console.log('â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
    console.log('');
    console.log(' Modulos ativos:');
    console.log(`  Motor NCT v2  : ${motorNCT    ? 'âœ…' : 'âŒ'}`);
    console.log(`  Conectores    : ${conectores  ? 'âœ…' : 'âŒ'}`);
    console.log(`  Banner gerador: ${banner      ? 'âœ…' : 'âŒ'}`);
    console.log(`  Bling token   : ${blingToken  ? 'âœ…' : 'âŒ'}`);
    console.log('');
    console.log(' Endpoints principais:');
    console.log('  POST /api/motor/triangular');
    console.log('  POST /api/motor/nf');
    console.log('  POST /api/banner/gerar');
    console.log('  POST /api/conectores');
    console.log('  GET  /api/health');
    console.log('  GET  /api/bling/status');
    console.log('  POST /api/bling/token/renovar');
    console.log('');
});

module.exports = app;


