const express = require("express");
const router  = express.Router();
const bling   = require("./services/bling");
const gemini  = require("./services/gemini");
const motor   = require("./services/motor");

const INTERVALO = parseInt(process.env.INDEXADOR_INTERVALO) || 300000;
const LOTE      = parseInt(process.env.INDEXADOR_LOTE)      || 10;
const ATIVO_ENV = process.env.INDEXADOR_ATIVO !== "false";

let estado = {
  ativo: false, emExecucao: false,
  ciclos: 0, erros: 0,
  ultimoCiclo: null, ultimoErro: null, timer: null
};

async function executarCiclo() {
  if (estado.emExecucao) return;
  estado.emExecucao = true;
  console.log("[INDEXADOR] Ciclo #" + (estado.ciclos + 1) + " iniciado");
  try {
    const result = await bling.listarProdutos({ limite: LOTE, pagina: 1 });
    const produtos = result.produtos || result.data || [];
    for (const produto of produtos) {
      try {
        const enrich = await gemini.enriquecerProduto(produto);
        const dados  = enrich.ok ? { ...produto, ...enrich.dados } : produto;
        const nct    = motor.calcularNCT(dados);
        const hash   = motor.gerarRastHash(produto.codigo || produto.sku || "", produto.codigoOEM || "", "MOBIS");
        await bling.atualizarProduto(produto.id, { ...dados, ...nct, observacoes: hash });
      } catch (e) {
        estado.erros++;
        estado.ultimoErro = e.message;
        console.error("[INDEXADOR] Erro produto " + (produto.id || produto.codigo) + ": " + e.message);
      }
    }
    estado.ciclos++;
    estado.ultimoCiclo = new Date().toISOString();
    console.log("[INDEXADOR] Ciclo #" + estado.ciclos + " OK — " + produtos.length + " produtos");
  } catch (e) {
    estado.erros++;
    estado.ultimoErro = e.message;
    console.error("[INDEXADOR] Erro no ciclo: " + e.message);
  }
  estado.emExecucao = false;
}

function iniciar() {
  if (estado.ativo) return;
  estado.ativo = true;
  executarCiclo();
  estado.timer = setInterval(executarCiclo, INTERVALO);
  console.log("[INDEXADOR] Ativo — ciclo a cada " + (INTERVALO / 1000) + "s, lote " + LOTE);
}

function parar() {
  if (!estado.ativo) return;
  clearInterval(estado.timer);
  estado.timer = null;
  estado.ativo = false;
  console.log("[INDEXADOR] Parado");
}

router.get("/status", (req, res) => {
  res.json({ ok: true, ativo: estado.ativo, emExecucao: estado.emExecucao,
    ciclos: estado.ciclos, erros: estado.erros, ultimoCiclo: estado.ultimoCiclo,
    ultimoErro: estado.ultimoErro, intervalo: INTERVALO, lote: LOTE });
});

router.post("/forcar", (req, res) => {
  if (estado.emExecucao) return res.json({ ok: false, msg: "Ciclo ja em execucao" });
  executarCiclo();
  res.json({ ok: true, msg: "Ciclo iniciado manualmente" });
});

router.post("/parar", (req, res) => {
  parar();
  res.json({ ok: true, msg: "Indexador parado" });
});

router.post("/iniciar", (req, res) => {
  iniciar();
  res.json({ ok: true, msg: "Indexador iniciado", intervalo: INTERVALO });
});

if (ATIVO_ENV) iniciar();

module.exports = router;
