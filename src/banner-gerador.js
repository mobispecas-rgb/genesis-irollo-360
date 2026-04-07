/**
 * @copyright 2026 Jose Nunes Junior / MOBIS Pecas
 * @license Proprietario — Todos os direitos reservados
 *
 * banner-gerador.js
 * Genesis iRollo 360 · genesisindexia.com.br
 *
 * GERADOR DE BANNERS AUTOMÁTICO
 * Gera banners HTML/Canvas prontos para redes sociais
 * usando os dados enriquecidos do Motor NCT.
 *
 * FORMATOS:
 *   1080x1080 — Instagram Feed / Facebook
 *   1080x1920 — Stories / Reels / TikTok
 *   1280x720  — YouTube / WhatsApp / LinkedIn
 *   800x800   — WhatsApp catálogo
 *
 * MODOS:
 *   informativo — sem preço (atrair cliente)
 *   com_preco   — com preço e botão ZAP
 *   promocional — com desconto e urgência
 *
 * USO:
 *   const bg = require('./banner-gerador');
 *   const html = bg.gerarHTML(produto, { formato: '1080x1080', modo: 'com_preco' });
 *   const arquivo = await bg.salvarPNG(produto, opcoes); // requer puppeteer
 */

const fs   = require('fs');
const path = require('path');

// ============================================================
// FORMATOS DISPONÍVEIS
// ============================================================
const FORMATOS = {
  '1080x1080': { w: 1080, h: 1080, nome: 'Feed Instagram/Facebook',  escala: 0.5 },
  '1080x1920': { w: 1080, h: 1920, nome: 'Stories/Reels/TikTok',     escala: 0.5 },
  '1280x720' : { w: 1280, h: 720,  nome: 'YouTube/WhatsApp/LinkedIn', escala: 0.5 },
  '800x800'  : { w: 800,  h: 800,  nome: 'WhatsApp catálogo',         escala: 0.5 },
};

// ============================================================
// PALETA DE CORES — ajustável por cliente (white-label)
// ============================================================
const PALETA_PADRAO = {
  fundo       : '#0D0D0D',
  fundo2      : '#1A1A1A',
  acento      : '#F5A623',
  acento2     : '#E8593C',
  texto_claro : '#FFFFFF',
  texto_muted : '#9B9B9B',
  verde       : '#27AE60',
  borda       : '#2C2C2C',
  zap         : '#25D366',
};

// ============================================================
// GERAR HTML DO BANNER
// Retorna HTML completo renderizável no browser / puppeteer
// ============================================================
function gerarHTML(produto, opcoes = {}) {
  const formato = FORMATOS[opcoes.formato] || FORMATOS['1080x1080'];
  const modo    = opcoes.modo    || 'informativo';
  const paleta  = { ...PALETA_PADRAO, ...(opcoes.paleta || {}) };
  const zap     = opcoes.zap    || '5562991654515';
  const logo    = opcoes.logo   || '';

  // Dados do produto
  const b1 = produto.blocos?.b1 || {};
  const b2 = produto.blocos?.b2 || {};
  const b5 = produto.blocos?.b5 || {};
  const b6 = produto.blocos?.b6 || {};
  const b9 = produto.blocos?.b9 || {};

  const nome       = produto.nome || b9.title || 'Produto';
  const fabricante = b1.fabricante || '';
  const oem        = b1.oem?.split('/')[0]?.trim() || b1.sku || '';
  const aplicacao  = b5.texto?.substring(0, 60) || '';
  const categoria  = b2.categoria || '';
  const imagem     = b6.frontal || b6.lateral_d || opcoes.imagem_url || '';
  const preco      = opcoes.preco     || '';
  const preco_de   = opcoes.preco_de  || '';
  const nct        = produto.nct?.score || 0;

  // Gera link do WhatsApp
  const msg = encodeURIComponent(
    `Olá! Tenho interesse no produto:\n*${nome}*\nOEM: ${oem}\nAplicação: ${aplicacao}`
  );
  const link_zap = `https://wa.me/${zap.replace(/\D/g,'')}?text=${msg}`;

  const { w, h } = formato;
  const escala = formato.escala;

  // ============================================================
  // LAYOUT DINÂMICO POR FORMATO
  // ============================================================

  if (w === 1080 && h === 1920) {
    // STORIES / REELS — vertical
    return _htmlStories({ nome, fabricante, oem, aplicacao, categoria, imagem, preco, preco_de, logo, paleta, link_zap, modo, w, h, escala, nct });
  }

  if (w === 1280 && h === 720) {
    // YOUTUBE / LINKEDIN — horizontal
    return _htmlHorizontal({ nome, fabricante, oem, aplicacao, categoria, imagem, preco, preco_de, logo, paleta, link_zap, modo, w, h, escala, nct });
  }

  // PADRÃO — quadrado (Feed Instagram/Facebook/WhatsApp)
  return _htmlQuadrado({ nome, fabricante, oem, aplicacao, categoria, imagem, preco, preco_de, logo, paleta, link_zap, modo, w, h, escala, nct });
}

// ============================================================
// BANNER QUADRADO — 1080x1080
// ============================================================
function _htmlQuadrado({ nome, fabricante, oem, aplicacao, categoria, imagem, preco, preco_de, logo, paleta, link_zap, modo, w, h, escala, nct }) {
  const W = w * escala, H = h * escala;
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
* { margin:0;padding:0;box-sizing:border-box; }
body { width:${W}px;height:${H}px;overflow:hidden;font-family:'Segoe UI',Arial,sans-serif;background:${paleta.fundo}; }
.banner { width:${W}px;height:${H}px;position:relative;display:flex;flex-direction:column; }
.topo { padding:18px 20px 10px;display:flex;justify-content:space-between;align-items:center; }
.logo-area { font-size:11px;font-weight:700;color:${paleta.acento};letter-spacing:2px;text-transform:uppercase; }
.categoria { font-size:10px;color:${paleta.texto_muted};padding:3px 10px;border:1px solid ${paleta.borda};border-radius:20px; }
.imagem-area { flex:1;position:relative;overflow:hidden;margin:0 20px; }
.imagem-area img { width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 8px 24px rgba(0,0,0,0.6)); }
.sem-img { width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:${paleta.texto_muted};font-size:13px; }
.info { padding:14px 20px;background:${paleta.fundo2};border-top:1px solid ${paleta.borda}; }
.nome { font-size:14px;font-weight:700;color:${paleta.texto_claro};line-height:1.3;margin-bottom:6px;
        display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden; }
.oem-linha { display:flex;gap:8px;align-items:center;margin-bottom:6px;flex-wrap:wrap; }
.badge { font-size:9px;font-weight:700;color:${paleta.fundo};background:${paleta.acento};
         padding:2px 8px;border-radius:3px;letter-spacing:0.5px; }
.badge-fab { background:${paleta.acento2}; }
.aplicacao { font-size:10px;color:${paleta.texto_muted};margin-bottom:8px;
             white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
.preco-area { display:flex;align-items:center;justify-content:space-between; }
.preco-de { font-size:11px;color:${paleta.texto_muted};text-decoration:line-through; }
.preco-por { font-size:22px;font-weight:800;color:${paleta.acento}; }
.btn-zap { display:inline-flex;align-items:center;gap:5px;padding:7px 14px;
           background:${paleta.zap};color:#fff;border-radius:6px;
           font-size:10px;font-weight:700;text-decoration:none; }
.nct-badge { position:absolute;top:14px;right:14px;background:rgba(39,174,96,0.9);
             color:#fff;font-size:9px;font-weight:700;padding:3px 8px;border-radius:3px; }
.faixa-acento { position:absolute;bottom:0;left:0;right:0;height:3px;background:linear-gradient(90deg,${paleta.acento},${paleta.acento2}); }
</style>
</head>
<body>
<div class="banner">
  <div class="topo">
    <div class="logo-area">${logo || 'Genesis iRollo 360'}</div>
    <div class="categoria">${categoria || 'Autopeças'}</div>
  </div>

  <div class="imagem-area">
    ${imagem
      ? `<img src="${imagem}" alt="${nome}" onerror="this.style.display='none'">`
      : `<div class="sem-img">📷 Imagem não disponível</div>`}
    ${nct >= 0.90 ? `<div class="nct-badge">NCT ${nct.toFixed(2)} ✓</div>` : ''}
  </div>

  <div class="info">
    <div class="nome">${nome}</div>
    <div class="oem-linha">
      ${oem        ? `<span class="badge">OEM ${oem}</span>` : ''}
      ${fabricante ? `<span class="badge badge-fab">${fabricante}</span>` : ''}
    </div>
    ${aplicacao ? `<div class="aplicacao">🚗 ${aplicacao}</div>` : ''}

    <div class="preco-area">
      <div>
        ${preco_de  ? `<div class="preco-de">De R$ ${preco_de}</div>` : ''}
        ${preco     ? `<div class="preco-por">R$ ${preco}</div>`
                    : modo === 'informativo'
                      ? `<div style="font-size:11px;color:${paleta.texto_muted}">Consulte disponibilidade</div>`
                      : ''}
      </div>
      <a href="${link_zap}" class="btn-zap">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
        </svg>
        Consultar ZAP
      </a>
    </div>
  </div>

  <div class="faixa-acento"></div>
</div>
</body>
</html>`;
}

// ============================================================
// BANNER STORIES — 1080x1920
// ============================================================
function _htmlStories({ nome, fabricante, oem, aplicacao, categoria, imagem, preco, preco_de, logo, paleta, link_zap, modo, w, h, escala, nct }) {
  const W = w * escala, H = h * escala;
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
* { margin:0;padding:0;box-sizing:border-box; }
body { width:${W}px;height:${H}px;overflow:hidden;font-family:'Segoe UI',Arial,sans-serif;background:${paleta.fundo}; }
.banner { width:${W}px;height:${H}px;position:relative;display:flex;flex-direction:column; }
.topo { padding:24px 28px 16px;display:flex;justify-content:space-between;align-items:center; }
.logo-area { font-size:14px;font-weight:800;color:${paleta.acento};letter-spacing:2px;text-transform:uppercase; }
.categoria { font-size:11px;color:${paleta.texto_muted};padding:4px 12px;border:1px solid ${paleta.borda};border-radius:20px; }
.imagem-area { height:480px;position:relative;overflow:hidden;margin:0 28px;border-radius:16px;background:${paleta.fundo2}; }
.imagem-area img { width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 12px 32px rgba(0,0,0,0.7)); }
.destaque { margin:24px 28px 0;padding:20px 24px;background:${paleta.fundo2};border-radius:16px;border:1px solid ${paleta.borda}; }
.nome { font-size:20px;font-weight:800;color:${paleta.texto_claro};line-height:1.3;margin-bottom:10px; }
.oem-linha { display:flex;gap:10px;margin-bottom:10px;flex-wrap:wrap; }
.badge { font-size:11px;font-weight:700;color:${paleta.fundo};background:${paleta.acento};padding:4px 12px;border-radius:4px; }
.badge-fab { background:${paleta.acento2}; }
.aplicacao { font-size:12px;color:${paleta.texto_muted};margin-bottom:16px;line-height:1.5; }
.linha-h { height:1px;background:${paleta.borda};margin:16px 0; }
.preco-area { display:flex;align-items:flex-end;justify-content:space-between; }
.preco-de { font-size:13px;color:${paleta.texto_muted};text-decoration:line-through;margin-bottom:4px; }
.preco-por { font-size:32px;font-weight:900;color:${paleta.acento}; }
.rodape { margin:24px 28px 0; }
.btn-zap { display:flex;align-items:center;justify-content:center;gap:10px;padding:18px;
           background:${paleta.zap};color:#fff;border-radius:14px;
           font-size:15px;font-weight:800;text-decoration:none; }
.swipe { text-align:center;margin-top:16px;font-size:11px;color:${paleta.texto_muted}; }
.nct-badge { position:absolute;top:14px;right:14px;background:rgba(39,174,96,0.9);
             color:#fff;font-size:10px;font-weight:700;padding:4px 10px;border-radius:4px; }
.faixa { height:4px;background:linear-gradient(90deg,${paleta.acento},${paleta.acento2});margin:20px 28px 0;border-radius:2px; }
</style>
</head>
<body>
<div class="banner">
  <div class="topo">
    <div class="logo-area">${logo || 'Genesis iRollo 360'}</div>
    <div class="categoria">${categoria || 'Autopeças'}</div>
  </div>

  <div class="faixa"></div>

  <div class="imagem-area">
    ${imagem ? `<img src="${imagem}" alt="${nome}">` : ''}
    ${nct >= 0.90 ? `<div class="nct-badge">NCT ${nct.toFixed(2)} ✓</div>` : ''}
  </div>

  <div class="destaque">
    <div class="nome">${nome}</div>
    <div class="oem-linha">
      ${oem        ? `<span class="badge">OEM ${oem}</span>` : ''}
      ${fabricante ? `<span class="badge badge-fab">${fabricante}</span>` : ''}
    </div>
    ${aplicacao ? `<div class="aplicacao">🚗 ${aplicacao}</div>` : ''}
    <div class="linha-h"></div>
    <div class="preco-area">
      <div>
        ${preco_de ? `<div class="preco-de">De R$ ${preco_de}</div>` : ''}
        ${preco    ? `<div class="preco-por">R$ ${preco}</div>`
                   : `<div style="font-size:14px;color:${paleta.texto_muted}">Consulte disponibilidade</div>`}
      </div>
    </div>
  </div>

  <div class="rodape">
    <a href="${link_zap}" class="btn-zap">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
        <path d="M12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.304-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413A11.824 11.824 0 0012.05 0z"/>
      </svg>
      Consultar no WhatsApp
    </a>
    <div class="swipe">👆 Deslize para cima</div>
  </div>
</div>
</body>
</html>`;
}

// ============================================================
// BANNER HORIZONTAL — 1280x720
// ============================================================
function _htmlHorizontal({ nome, fabricante, oem, aplicacao, categoria, imagem, preco, preco_de, logo, paleta, link_zap, modo, w, h, escala, nct }) {
  const W = w * escala, H = h * escala;
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
* { margin:0;padding:0;box-sizing:border-box; }
body { width:${W}px;height:${H}px;overflow:hidden;font-family:'Segoe UI',Arial,sans-serif;background:${paleta.fundo}; }
.banner { width:${W}px;height:${H}px;position:relative;display:flex; }
.lado-img { width:48%;position:relative;overflow:hidden;background:${paleta.fundo2};border-right:1px solid ${paleta.borda}; }
.lado-img img { width:100%;height:100%;object-fit:contain;padding:20px;filter:drop-shadow(0 8px 24px rgba(0,0,0,0.6)); }
.lado-info { flex:1;display:flex;flex-direction:column;padding:28px 32px; }
.logo-area { font-size:12px;font-weight:800;color:${paleta.acento};letter-spacing:2px;text-transform:uppercase;margin-bottom:6px; }
.categoria { font-size:10px;color:${paleta.texto_muted};margin-bottom:20px; }
.nome { font-size:18px;font-weight:800;color:${paleta.texto_claro};line-height:1.3;margin-bottom:12px;
        display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden; }
.oem-linha { display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap; }
.badge { font-size:10px;font-weight:700;color:${paleta.fundo};background:${paleta.acento};padding:3px 10px;border-radius:3px; }
.badge-fab { background:${paleta.acento2}; }
.aplicacao { font-size:11px;color:${paleta.texto_muted};margin-bottom:16px;line-height:1.5; }
.espacador { flex:1; }
.linha-h { height:1px;background:${paleta.borda};margin:14px 0; }
.preco-area { display:flex;align-items:center;justify-content:space-between;margin-bottom:14px; }
.preco-de { font-size:12px;color:${paleta.texto_muted};text-decoration:line-through; }
.preco-por { font-size:26px;font-weight:900;color:${paleta.acento}; }
.btn-zap { display:inline-flex;align-items:center;gap:8px;padding:12px 20px;
           background:${paleta.zap};color:#fff;border-radius:8px;
           font-size:12px;font-weight:700;text-decoration:none; }
.nct-badge { position:absolute;top:12px;right:12px;background:rgba(39,174,96,0.9);
             color:#fff;font-size:9px;font-weight:700;padding:3px 8px;border-radius:3px; }
.faixa { position:absolute;left:0;bottom:0;right:0;height:4px;background:linear-gradient(90deg,${paleta.acento},${paleta.acento2}); }
</style>
</head>
<body>
<div class="banner">
  <div class="lado-img">
    ${imagem ? `<img src="${imagem}" alt="${nome}">` : ''}
    ${nct >= 0.90 ? `<div class="nct-badge">NCT ${nct.toFixed(2)} ✓</div>` : ''}
  </div>

  <div class="lado-info">
    <div class="logo-area">${logo || 'Genesis iRollo 360'}</div>
    <div class="categoria">${categoria || 'Autopeças'}</div>
    <div class="nome">${nome}</div>
    <div class="oem-linha">
      ${oem        ? `<span class="badge">OEM ${oem}</span>` : ''}
      ${fabricante ? `<span class="badge badge-fab">${fabricante}</span>` : ''}
    </div>
    ${aplicacao ? `<div class="aplicacao">🚗 ${aplicacao}</div>` : ''}

    <div class="espacador"></div>
    <div class="linha-h"></div>

    <div class="preco-area">
      <div>
        ${preco_de ? `<div class="preco-de">De R$ ${preco_de}</div>` : ''}
        ${preco    ? `<div class="preco-por">R$ ${preco}</div>`
                   : `<div style="font-size:12px;color:${paleta.texto_muted}">Consulte disponibilidade</div>`}
      </div>
    </div>

    <a href="${link_zap}" class="btn-zap">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
        <path d="M12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.304-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413A11.824 11.824 0 0012.05 0z"/>
      </svg>
      Consultar no WhatsApp
    </a>
  </div>

  <div class="faixa"></div>
</div>
</body>
</html>`;
}

// ============================================================
// SALVAR TODOS OS FORMATOS — gera os 4 HTMLs de uma vez
// ============================================================
function gerarTodos(produto, opcoes = {}) {
  const resultados = {};
  for (const [formato, def] of Object.entries(FORMATOS)) {
    resultados[formato] = {
      html   : gerarHTML(produto, { ...opcoes, formato }),
      formato: def.nome,
      tamanho: `${def.w}x${def.h}`,
    };
  }
  return resultados;
}

// ============================================================
// SALVAR HTML em arquivo
// ============================================================
function salvarHTML(produto, opcoes = {}) {
  const formato = opcoes.formato || '1080x1080';
  const html    = gerarHTML(produto, opcoes);
  const sku     = produto.blocos?.b1?.sku || 'produto';
  const arquivo = path.join(opcoes.pasta || './banners', `banner-${sku}-${formato}.html`);

  if (!fs.existsSync(path.dirname(arquivo)))
    fs.mkdirSync(path.dirname(arquivo), { recursive: true });

  fs.writeFileSync(arquivo, html, 'utf8');
  console.log(`[Banner] Salvo: ${arquivo}`);
  return arquivo;
}

// ============================================================
// SALVAR PNG — requer puppeteer instalado
// npm install puppeteer
// ============================================================
async function salvarPNG(produto, opcoes = {}) {
  let puppeteer;
  try { puppeteer = require('puppeteer'); }
  catch (_) {
    console.error('[Banner] puppeteer não instalado. Execute: npm install puppeteer');
    return null;
  }

  const formato = FORMATOS[opcoes.formato || '1080x1080'];
  const html    = gerarHTML(produto, opcoes);
  const sku     = produto.blocos?.b1?.sku || 'produto';
  const arquivo = path.join(opcoes.pasta || './banners', `banner-${sku}-${opcoes.formato || '1080x1080'}.png`);

  if (!fs.existsSync(path.dirname(arquivo)))
    fs.mkdirSync(path.dirname(arquivo), { recursive: true });

  const browser = await puppeteer.launch({ headless: 'new' });
  const page    = await browser.newPage();

  await page.setViewport({ width: Math.round(formato.w * formato.escala), height: Math.round(formato.h * formato.escala) });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.screenshot({ path: arquivo, type: 'png', fullPage: false });
  await browser.close();

  console.log(`[Banner] PNG salvo: ${arquivo}`);
  return arquivo;
}

// ============================================================
// ROTAS EXPRESS
// ============================================================
function registrarRotas(app) {

  // Gera HTML do banner via API
  app.post('/api/banner/gerar', (req, res) => {
    try {
      const { produto, formato, modo, preco, preco_de, logo, paleta, zap } = req.body;
      if (!produto) return res.status(400).json({ ok: false, erro: 'produto obrigatório' });

      const html = gerarHTML(produto, { formato, modo, preco, preco_de, logo, paleta, zap });
      return res.json({ ok: true, html, formato: formato || '1080x1080' });
    } catch (e) {
      return res.status(500).json({ ok: false, erro: e.message });
    }
  });

  // Gera todos os formatos de uma vez
  app.post('/api/banner/todos', (req, res) => {
    try {
      const { produto, ...opcoes } = req.body;
      if (!produto) return res.status(400).json({ ok: false, erro: 'produto obrigatório' });

      const todos = gerarTodos(produto, opcoes);
      return res.json({ ok: true, banners: todos });
    } catch (e) {
      return res.status(500).json({ ok: false, erro: e.message });
    }
  });

  // Gera PNG (requer puppeteer no servidor)
  app.post('/api/banner/png', async (req, res) => {
    try {
      const { produto, ...opcoes } = req.body;
      const arquivo = await salvarPNG(produto, opcoes);
      if (!arquivo) return res.status(500).json({ ok: false, erro: 'puppeteer não instalado' });
      res.download(arquivo);
    } catch (e) {
      return res.status(500).json({ ok: false, erro: e.message });
    }
  });
}

// ============================================================
// EXPORTS
// ============================================================
module.exports = { gerarHTML, gerarTodos, salvarHTML, salvarPNG, registrarRotas, FORMATOS, PALETA_PADRAO };

// ============================================================
// TESTE DIRETO: node banner-gerador.js
// ============================================================
if (require.main === module) {
  const produto = {
    nome  : 'Motor de Arranque Bosch 1986S00925 12V 13 Dentes',
    nct   : { score: 0.9535 },
    blocos: {
      b1: { ean: '4047026608724', oem: '3610042200', sku: '1986S00925', fabricante: 'Bosch' },
      b2: { categoria: 'Elétrica / Sistema de Partida' },
      b5: { texto: 'Hyundai Galloper I/II · Mitsubishi L200 · H100' },
      b6: { frontal: 'https://via.placeholder.com/400x400/1A1A1A/F5A623?text=Bosch+1986S00925' },
      b9: { title: 'Motor Arranque Bosch 1986S00925 Galloper L200 12V 13D' },
    },
  };

  console.log('\n=== Genesis iRollo 360 · Banner Gerador · by Junior/MOBIS ===\n');

  // Gera HTML para cada formato
  for (const formato of ['1080x1080', '1080x1920', '1280x720']) {
    const arquivo = salvarHTML(produto, {
      formato,
      modo   : 'com_preco',
      preco  : '890,00',
      preco_de: '1.100,00',
      zap    : '5562991654515',
    });
    console.log(`Gerado: ${arquivo}`);
  }
}
