// ============================================================
// GENESIS iROLLO 360 — BANCO DE DADOS SQLite
// better-sqlite3 | Persistência entre reinicializações
// ============================================================
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = process.env.DB_PATH || path.join(__dirname, '../../data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const DB_FILE = path.join(DB_DIR, 'genesis.db');
const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS sessoes (
    token       TEXT PRIMARY KEY,
    email       TEXT NOT NULL,
    expira      INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS produtos (
    id            TEXT PRIMARY KEY,
    nome          TEXT NOT NULL,
    oem           TEXT, sku TEXT, ncm TEXT, nct REAL, rast_hash TEXT,
    situacao      TEXT DEFAULT 'Ativo',
    id_bling      TEXT, aplicacao TEXT, dados_json TEXT,
    cadastrado_em TEXT, atualizado_em TEXT, fonte TEXT DEFAULT 'local'
  );
  CREATE TABLE IF NOT EXISTS nct_historico (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    produto_id TEXT, nct_valor REAL, decisao TEXT,
    calculado_em TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS config (
    chave       TEXT PRIMARY KEY,
    valor       TEXT NOT NULL,
    atualizado_em TEXT DEFAULT (datetime('now'))
  );
`);

// Sessoes
const sessaoSet    = db.prepare('INSERT OR REPLACE INTO sessoes (token,email,expira) VALUES (?,?,?)');
const sessaoGet    = db.prepare('SELECT * FROM sessoes WHERE token = ?');
const sessaoDelete = db.prepare('DELETE FROM sessoes WHERE token = ?');
const sessaoLimpar = db.prepare('DELETE FROM sessoes WHERE expira < ?');

// Produtos
const produtoInsert = db.prepare(`
  INSERT OR REPLACE INTO produtos
    (id,nome,oem,sku,ncm,nct,rast_hash,situacao,id_bling,aplicacao,dados_json,cadastrado_em,fonte)
  VALUES
    (@id,@nome,@oem,@sku,@ncm,@nct,@rast_hash,@situacao,@id_bling,@aplicacao,@dados_json,@cadastrado_em,@fonte)
`);
const produtoUpdate = db.prepare(`
  UPDATE produtos SET
    nome=@nome,oem=@oem,sku=@sku,ncm=@ncm,nct=@nct,rast_hash=@rast_hash,
    situacao=@situacao,id_bling=@id_bling,aplicacao=@aplicacao,
    dados_json=@dados_json,atualizado_em=@atualizado_em
  WHERE id=@busca_id OR id_bling=@busca_id
`);
const produtoGetById = db.prepare('SELECT * FROM produtos WHERE id=? OR id_bling=? LIMIT 1');
const produtoDelete  = db.prepare('DELETE FROM produtos WHERE id=? OR id_bling=?');
const produtoListar  = db.prepare(`
  SELECT * FROM produtos
  WHERE (:nome IS NULL OR LOWER(nome) LIKE '%' || LOWER(:nome) || '%')
  ORDER BY cadastrado_em DESC
  LIMIT :limite OFFSET :offset
`);
const produtoContar = db.prepare(`
  SELECT COUNT(*) as total FROM produtos
  WHERE (:nome IS NULL OR LOWER(nome) LIKE '%' || LOWER(:nome) || '%')
`);
const maxLocalId = db.prepare("SELECT MAX(CAST(REPLACE(id,'LOCAL-','') AS INTEGER)) as m FROM produtos WHERE id LIKE 'LOCAL-%'");

function nextLocalId() {
  const row = maxLocalId.get();
  return 'LOCAL-' + ((row && row.m ? row.m : 999) + 1);
}

// Config (troca de senha e configuracoes persistentes)
const configGet = db.prepare('SELECT * FROM config WHERE chave = ?');
const configSet = db.prepare('INSERT OR REPLACE INTO config (chave,valor,atualizado_em) VALUES (?,?,?)');
const configDel = db.prepare('DELETE FROM config WHERE chave = ?');

module.exports = {
  db,
  sessoes: { set: sessaoSet, get: sessaoGet, delete: sessaoDelete, limpar: sessaoLimpar },
  produtos: {
    insert:  produtoInsert,
    update:  produtoUpdate,
    getById: produtoGetById,
    delete:  produtoDelete,
    listar:  produtoListar,
    contar:  produtoContar
  },
  config: { get: configGet, set: configSet, del: configDel },
  nextLocalId
};
