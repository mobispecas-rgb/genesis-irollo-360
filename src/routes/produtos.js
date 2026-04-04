// ============================================================
// ROUTES — /api/produtos
// ============================================================
const express = require('express');
const router = express.Router();
const bling = require('../services/bling');
const gemini = require('../services/gemini');
const motor = require('../services/motor');

// ------------------------------------------------------------
// GET /api/produtos — Listar produtos do Bling
// ------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const { pagina = 1, limite = 50, nome, situacao } = req.query;
    const result = await bling.listarProdutos({ pagina: parseInt(pagina), limite: parseInt(limite), nome, situacao });

    if (!result.ok) {
      return res.status(result.status || 500).json({ erro: result.error });
    }

    // Adiciona NCT e RAST-HASH em cada produto retornado
    const produtos = (result.data?.data || []).map(p => ({
      ...p,
      nct_calc: motor.calcularNCT({
        oem: p.codigo,
        ncm: p.tributacao?.ncm,
        nome: p.nome,
        sku: p.codigo
      }),
      rast_hash: motor.gerarRastHash(p.codigo, p.codigo)
    }));

    res.json({
      ok: true,
      total: result.data?.meta?.total || produtos.length,
      pagina: parseInt(pagina),
      produtos
    });

  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ------------------------------------------------------------
// GET /api/produtos/:id — Buscar produto por ID
// ------------------------------------------------------------
router.get('/:id', async (req, res) => {
  try {
    const result = await bling.buscarProduto(req.params.id);
    if (!result.ok) return res.status(404).json({ erro: result.error });

    const p = result.data?.data;
    const nctCalc = motor.calcularNCT({
      oem: p.codigo,
      ncm: p.tributacao?.ncm,
      nome: p.nome,
      sku: p.codigo
    });

    res.json({
      ok: true,
      produto: {
        ...p,
        nct: nctCalc.nct,
        decisao: nctCalc.decisao,
        rast_hash: motor.gerarRastHash(p.codigo, p.codigo),
        reino: motor.detectarReino({ nome: p.nome })
      }
    });

  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ------------------------------------------------------------
// POST /api/produtos — Criar produto (Motor NCT + Bling)
// ------------------------------------------------------------
router.post('/', async (req, res) => {
  try {
    const dados = req.body;

    // 1. Processar pelo Motor iRollo
    const processado = motor.processarProduto(dados);

    // 2. Verificar NCT mínimo
    const nctMinimo = parseFloat(process.env.NCT_MINIMO || 0.90);
    if (processado.nct < nctMinimo && !dados.forcar_cadastro) {
      return res.status(422).json({
        erro: 'NCT insuficiente para cadastro',
        nct: processado.nct,
        decisao: processado.decisao,
        minimo_exigido: nctMinimo,
        dica: 'Preencha mais campos técnicos ou use forcar_cadastro:true para Pendente'
      });
    }

    // 3. Enviar para Bling
    const result = await bling.criarProduto(processado);

    if (!result.ok) {
      return res.status(result.status || 500).json({
        erro: 'Erro ao criar no Bling',
        detalhes: result.error,
        produto_processado: processado
      });
    }

    res.status(201).json({
      ok: true,
      mensagem: 'Produto criado com sucesso no Bling!',
      id_bling: result.data?.data?.id,
      nct: processado.nct,
      decisao: processado.decisao,
      rast_hash: processado.rast_hash,
      nome_completo: processado.nome_completo
    });

  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ------------------------------------------------------------
// PUT /api/produtos/:id — Atualizar produto
// ------------------------------------------------------------
router.put('/:id', async (req, res) => {
  try {
    const processado = motor.processarProduto(req.body);
    const result = await bling.atualizarProduto(req.params.id, processado);

    if (!result.ok) return res.status(result.status || 500).json({ erro: result.error });

    res.json({
      ok: true,
      mensagem: 'Produto atualizado!',
      nct: processado.nct,
      rast_hash: processado.rast_hash
    });

  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ------------------------------------------------------------
// DELETE /api/produtos/:id
// ------------------------------------------------------------
router.delete('/:id', async (req, res) => {
  try {
    const result = await bling.deletarProduto(req.params.id);
    if (!result.ok) return res.status(result.status || 500).json({ erro: result.error });
    res.json({ ok: true, mensagem: 'Produto removido do Bling.' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ------------------------------------------------------------
// POST /api/produtos/:id/enriquecer — Enriquecer com Gemini
// ------------------------------------------------------------
router.post('/:id/enriquecer', async (req, res) => {
  try {
    // 1. Busca produto no Bling
    const blingResult = await bling.buscarProduto(req.params.id);
    if (!blingResult.ok) return res.status(404).json({ erro: 'Produto não encontrado no Bling' });

    const p = blingResult.data?.data;

    // 2. Enriquece com Gemini
    const enrich = await gemini.enriquecerProduto({
      oem: p.codigo,
      nome: p.nome,
      ncm: p.tributacao?.ncm,
      sku: p.codigo
    });

    // 3. Calcula NCT com dados enriquecidos
    const dados = {
      ...p,
      oem: p.codigo,
      nome: enrich.dados?.nome_enriquecido || p.nome,
      aplicacao: enrich.dados?.aplicacao_veicular,
      ncm: enrich.dados?.ncm_sugerido || p.tributacao?.ncm
    };
    const nctCalc = motor.calcularNCT(dados);

    // 4. Atualiza no Bling se aprovado
    let atualizadoBling = null;
    if (nctCalc.aprovado && enrich.ok) {
      const atualizado = await bling.atualizarProduto(req.params.id, {
        ...dados,
        nome_completo: enrich.dados.nome_enriquecido,
        descricao: enrich.dados.descricao_tecnica,
        descricao_curta: enrich.dados.descricao_curta,
        nct: nctCalc.nct,
        rast_hash: nctCalc.rast_hash,
        motor_versao: 'iRollo-v3.0'
      });
      atualizadoBling = atualizado.ok;
    }

    res.json({
      ok: true,
      produto_original: { id: p.id, nome: p.nome },
      enriquecimento: enrich.dados,
      nct: nctCalc.nct,
      decisao: nctCalc.decisao,
      rast_hash: nctCalc.rast_hash,
      atualizado_bling: atualizadoBling,
      mensagem: nctCalc.aprovado ? '✅ Produto enriquecido e aprovado!' : '⚠️ Enriquecido mas NCT insuficiente'
    });

  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
