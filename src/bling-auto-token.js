/**
 * bling-auto-token.js — v4.0
 * Genesis iRollo 360 · MOBIS Peças Automotivas
 *
 * Token Bling OAuth2 gerenciado 100% em memória.
 * Compatível com Railway (sem escrita em disco).
 * Renova automaticamente quando necessário.
 */

'use strict';

const axios = require('axios');
require('dotenv').config();

// ─── Cache em memória (persiste enquanto o processo viver) ────────────────────
let _cache = {
    access_token : process.env.BLING_ACCESS_TOKEN || '',
    refresh_token: process.env.BLING_REFRESH_TOKEN || '',
    expires_at   : Date.now() + (6 * 60 * 60 * 1000) // 6h padrão
};

// ─── Renovar token via Refresh Token ─────────────────────────────────────────
async function renovarToken() {
    const clientId     = process.env.BLING_CLIENT_ID     || '';
    const clientSecret = process.env.BLING_CLIENT_SECRET || '';
    const refreshToken = _cache.refresh_token || process.env.BLING_REFRESH_TOKEN || '';

  if (!clientId || !clientSecret || !refreshToken) {
        const faltando = [];
        if (!clientId)     faltando.push('BLING_CLIENT_ID');
        if (!clientSecret) faltando.push('BLING_CLIENT_SECRET');
        if (!refreshToken) faltando.push('BLING_REFRESH_TOKEN');
        throw new Error(`[BlingToken] Credenciais ausentes: ${faltando.join(', ')}`);
  }

  console.log('[BlingToken] Renovando access token...');

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const resp = await axios.post(
        'https://www.bling.com.br/Api/v3/oauth/token',
        new URLSearchParams({
                grant_type   : 'refresh_token',
                refresh_token: refreshToken
        }),
    {
            headers: {
                      'Authorization': `Basic ${credentials}`,
                      'Content-Type' : 'application/x-www-form-urlencoded'
            },
            timeout: 15000
    }
      );

  const dados = resp.data;

  _cache.access_token  = dados.access_token;
    _cache.expires_at    = Date.now() + ((dados.expires_in || 21600) * 1000);

  // Atualiza refresh_token em memória se vier novo
  if (dados.refresh_token) {
        _cache.refresh_token = dados.refresh_token;
        process.env.BLING_REFRESH_TOKEN = dados.refresh_token;
  }

  // Atualiza process.env para que services/bling.js também veja
  process.env.BLING_ACCESS_TOKEN = dados.access_token;

  console.log('[BlingToken] Token renovado! Expira em:', new Date(_cache.expires_at).toLocaleString('pt-BR'));
    return _cache.access_token;
}

// ─── Obter token válido (renova automaticamente se necessário) ────────────────
async function getToken() {
    const cincoMinutos = 5 * 60 * 1000;
    const expirado = Date.now() > (_cache.expires_at - cincoMinutos);

  if (expirado || !_cache.access_token) {
        try {
                await renovarToken();
        } catch (err) {
                console.error('[BlingToken] Falha ao renovar:', err.message);
                // Retorna token atual mesmo que falhe (pode ainda funcionar)
          if (!_cache.access_token) throw err;
        }
  }

  return _cache.access_token;
}

// ─── Status do token (para /api/bling/status) ────────────────────────────────
function statusToken() {
    return {
          tem_token      : !!_cache.access_token,
          expira_em      : _cache.expires_at ? new Date(_cache.expires_at).toISOString() : null,
          expirado       : Date.now() > _cache.expires_at,
          tem_client_id  : !!process.env.BLING_CLIENT_ID,
          tem_secret     : !!process.env.BLING_CLIENT_SECRET,
          tem_refresh    : !!(_cache.refresh_token || process.env.BLING_REFRESH_TOKEN)
    };
}

// ─── Inicialização: tenta renovar na startup se tiver credenciais ─────────────
(async () => {
    const podeRenovar = process.env.BLING_CLIENT_ID &&
                            process.env.BLING_CLIENT_SECRET &&
                            (process.env.BLING_REFRESH_TOKEN || _cache.refresh_token);

   if (podeRenovar && !_cache.access_token) {
         try {
                 await renovarToken();
         } catch (e) {
                 console.warn('[BlingToken] Startup: não foi possível obter token inicial:', e.message);
         }
   } else if (_cache.access_token) {
         console.log('[BlingToken] Token inicial carregado do environment.');
   } else {
         console.warn('[BlingToken] Credenciais Bling não configuradas. Configure no Railway: BLING_CLIENT_ID, BLING_CLIENT_SECRET, BLING_REFRESH_TOKEN');
   }
})();

module.exports = { getToken, renovarToken, statusToken };
