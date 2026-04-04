// ============================================================
// GENESIS iROLLO 360 — TESTE DE CONEXÃO
// Execute: node src/test-bling.js
// ============================================================
require('dotenv').config();
const bling = require('./services/bling');
const motor = require('./services/motor');

async function testar() {
  console.log('\n⚙️  GENESIS iROLLO 360 — TESTE DE SISTEMA\n');

  // 1. Motor NCT
  console.log('1. TESTANDO MOTOR NCT...');
  const resultado = motor.calcularNCT({
    oem: 'BDJ0430',
    ncm: '87089900',
    sku: 'TRIMGO-BDJ0430',
    nome: 'Bandeja Dianteira Superior Direita TRIMGO Honda Civic 2001-2006',
    aplicacao: 'Honda Civic 2001-2006 / Toyota Corolla 2003-2008'
  });
  console.log(`   NCT: ${resultado.nct} → ${resultado.decisao}`);
  console.log(`   RAST-HASH: ${resultado.rast_hash}\n`);

  // 2. Conexão Bling
  console.log('2. TESTANDO BLING API v3...');
  const blingStatus = await bling.testarConexao();
  if (blingStatus.ok) {
    console.log(`   ✅ ${blingStatus.mensagem}`);
  } else {
    console.log(`   ❌ Erro: ${blingStatus.erro}`);
    console.log('   → Verifique BLING_CLIENT_SECRET e BLING_REFRESH_TOKEN no .env\n');
  }

  // 3. Listar produtos reais
  if (blingStatus.ok) {
    console.log('\n3. LISTANDO PRODUTOS DO BLING...');
    const produtos = await bling.listarProdutos({ limite: 5 });
    if (produtos.ok) {
      const lista = produtos.data?.data || [];
      console.log(`   ${lista.length} produtos encontrados:`);
      lista.forEach(p => console.log(`   - [${p.codigo}] ${p.nome}`));
    }
  }

  console.log('\n✅ Teste concluído!\n');
}

testar().catch(console.error);
