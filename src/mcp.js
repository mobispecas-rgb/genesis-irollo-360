const GENESIS_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : 'http://localhost:3001';

let _McpServer = null;
let _SSEServerTransport = null;

async function loadSDK() {
  if (!_McpServer) {
    const mcp = await import('@modelcontextprotocol/sdk/server/mcp.js');
    const sse = await import('@modelcontextprotocol/sdk/server/sse.js');
    _McpServer = mcp.McpServer;
    _SSEServerTransport = sse.SSEServerTransport;
  }
}

function setupMCP(app) {
  const transports = {};

  app.get('/mcp/sse', async (req, res) => {
    try {
      await loadSDK();
      const server = new _McpServer({ name: 'genesis-irollo-360', version: '1.0.0' });
      server.tool('indexador_status', 'Ver status do indexador automatico', {}, async () => {
        const r = await fetch(`${GENESIS_URL}/api/indexador/status`);
        const d = await r.json();
        return { content: [{ type: 'text', text: JSON.stringify(d, null, 2) }] };
      });
      server.tool('indexador_forcar', 'Forcar ciclo agora (Bling > NCT > Gemini > Bling)', {}, async () => {
        const r = await fetch(`${GENESIS_URL}/api/indexador/forcar`, { method: 'POST' });
        const d = await r.json();
        return { content: [{ type: 'text', text: JSON.stringify(d, null, 2) }] };
      });
      server.tool('indexador_parar', 'Parar o indexador automatico', {}, async () => {
        const r = await fetch(`${GENESIS_URL}/api/indexador/parar`, { method: 'POST' });
        const d = await r.json();
        return { content: [{ type: 'text', text: JSON.stringify(d, null, 2) }] };
      });
      server.tool('indexador_iniciar', 'Reiniciar o indexador automatico', {}, async () => {
        const r = await fetch(`${GENESIS_URL}/api/indexador/iniciar`, { method: 'POST' });
        const d = await r.json();
        return { content: [{ type: 'text', text: JSON.stringify(d, null, 2) }] };
      });
      const transport = new _SSEServerTransport('/mcp/messages', res);
      transports[transport.sessionId] = transport;
      res.on('close', () => delete transports[transport.sessionId]);
      await server.connect(transport);
    } catch (err) {
      res.status(500).json({ erro: err.message });
    }
  });

  app.post('/mcp/messages', async (req, res) => {
    const { sessionId } = req.query;
    const transport = transports[sessionId];
    if (!transport) return res.status(404).send('Sessao nao encontrada');
    await transport.handlePostMessage(req, res);
  });

  console.log('MCP ativo — /mcp/sse pronto');
}

module.exports = { setupMCP };
