// ============================================================
// ROUTES — /api/cruzada
// Triangulação cruzada + imagens para logista
// ============================================================
const express = require('express');
const router = express.Router();
const { triangularPecas, buscarImagensProduto, salvarImagemSelecionada, getImagemSalva } = require('../services/triangulacao-cruzada');

// POST /api/cruzada/triangular
router.post('/triangular', async (req, res) => {
  const { oem, nome } = req.body;
  if (!oem && !nome) return res.status(400).json({ erro: 'Informe oem ou nome' });
  try {
    res.json(await triangularPecas(req.body));
  } catch(err) { res.status(500).json({ ok:false, erro:err.message }); }
});

// GET /api/cruzada/imagens?oem=XX&nome=XX
router.get('/imagens', async (req, res) => {
  const { oem, nome } = req.query;
  if (!oem && !nome) return res.status(400).json({ erro: 'Informe oem ou nome' });
  try {
    const resultado = await buscarImagensProduto(oem, nome, 6);
    const selecionada = getImagemSalva(oem);
    res.json({ ...resultado, ja_selecionada: selecionada });
  } catch(err) { res.status(500).json({ ok:false, erro:err.message }); }
});

// POST /api/cruzada/imagens/selecionar
router.post('/imagens/selecionar', (req, res) => {
  const { oem, url, posicao } = req.body;
  if (!oem || !url) return res.status(400).json({ erro: 'Informe oem e url' });
  res.json(salvarImagemSelecionada(oem, url, posicao || 1));
});

// POST /api/cruzada/completo — triangula + imagens em uma chamada
router.post('/completo', async (req, res) => {
  const { oem, nome, ncm, aplicacao, categoria } = req.body;
  if (!oem && !nome) return res.status(400).json({ erro: 'Informe oem ou nome' });
  try {
    const [triangulo, imagens] = await Promise.all([
      triangularPecas({ oem, nome, ncm, aplicacao, categoria }),
      buscarImagensProduto(oem, nome, 6)
    ]);
    res.json({ ok:true, produto:{ oem,nome,ncm,aplicacao }, triangulo, imagens, gerado_em:new Date().toISOString() });
  } catch(err) { res.status(500).json({ ok:false, erro:err.message }); }
});

module.exports = router;
