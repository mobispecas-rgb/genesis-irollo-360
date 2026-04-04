# ⚙️ Genesis iRollo 360 — Backend Node.js
## MOBIS Peças Automotivas | Motor iRollo v3.0

---

## 🚀 INSTALAÇÃO (5 minutos)

### Pré-requisitos
- Node.js 18+ instalado
- Credenciais Bling API v3 (você já tem!)
- Gemini API Key (Google AI Studio — gratuito)

### Passo 1 — Instalar dependências
```bash
cd genesis-backend
npm install
```

### Passo 2 — Configurar credenciais no .env
Abra o arquivo `.env` e preencha:

```env
# BLING (você já tem esses valores!)
BLING_CLIENT_ID=837cda747405553caae6ecaf542e96abe4498317
BLING_CLIENT_SECRET=SEU_CLIENT_SECRET_AQUI    ← preencher
BLING_REFRESH_TOKEN=56a9f9b51b6d0dc57b30e1bdc059cd65e327a03a

# GEMINI (gratuito em aistudio.google.com/api-keys)
GEMINI_API_KEY=AIzaSy...                       ← preencher
```

### Passo 3 — Testar conexão
```bash
npm test
```

### Passo 4 — Iniciar servidor
```bash
npm run dev
```
Backend rodando em: **http://localhost:3001**

---

## 📋 ENDPOINTS PRINCIPAIS

### 🧠 Motor iRollo
```
POST http://localhost:3001/api/motor/nct
Body: { "oem": "BDJ0430", "ncm": "87089900", "sku": "TRIMGO-BDJ0430", "nome": "Bandeja..." }
→ Retorna NCT score + RAST-HASH + decisão

POST http://localhost:3001/api/motor/enriquecer
Body: { "oem": "BDJ0430", "nome": "Bandeja Dianteira" }
→ Enriquece via Gemini + calcula NCT
```

### 📦 Produtos Bling
```
GET  http://localhost:3001/api/produtos?limite=50
→ Lista produtos reais do Bling

POST http://localhost:3001/api/produtos
Body: { "oem": "BDJ0430", "ncm": "87089900", "sku": "TRIMGO-BDJ0430", "nome": "...", "preco": 89.90 }
→ Valida NCT e cria no Bling

POST http://localhost:3001/api/produtos/:id/enriquecer
→ Enriquece produto existente no Bling com Gemini
```

### 🔗 Bling Status
```
GET  http://localhost:3001/api/bling/status
→ Testa conexão + token

POST http://localhost:3001/api/bling/token/renovar
→ Renova access token via refresh token
```

### 📊 Cadastro em Massa
```
POST http://localhost:3001/api/massa/upload
Form-data: planilha = arquivo.csv
→ Parse + NCT de todos os produtos

POST http://localhost:3001/api/massa/enviar-bling
Body: { "produtos": [...] }
→ Envia lote aprovado para Bling
```

---

## 📄 FORMATO CSV ESPERADO

```csv
nome,oem,sku,ncm,preco,estoque,aplicacao,categoria,marca
Bandeja Dianteira Dir,BDJ0430,TRIMGO-BDJ0430,87089900,89.90,5,Honda Civic 2001,Suspensão,TRIMGO
Amortecedor Diant,AMR-001,TRIMGO-AMR001,87084000,245.00,3,Toyota Corolla 2003,Amortecedores,TRIMGO
```

Colunas aceitas (variações):
- `nome` / `descricao` / `produto`
- `oem` / `codigo_oem` / `mpn`
- `sku` / `codigo` / `referencia`
- `ncm` / `cod_ncm`
- `preco` / `valor`
- `aplicacao` / `veiculo` / `compatibilidade`

---

## 🔥 DEPLOY NO FIREBASE

```bash
# Instalar Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Inicializar projeto
firebase init functions

# Deploy
firebase deploy
```

Após deploy: `https://genesis-irollo-360.web.app/api/`

---

## 🧪 EXEMPLOS DE TESTE (curl)

```bash
# Calcular NCT
curl -X POST http://localhost:3001/api/motor/nct \
  -H "Content-Type: application/json" \
  -d '{"oem":"BDJ0430","ncm":"87089900","sku":"TRIMGO-BDJ0430","nome":"Bandeja Dianteira TRIMGO Honda Civic","aplicacao":"Honda Civic 2001-2006"}'

# Listar produtos Bling
curl http://localhost:3001/api/produtos?limite=10

# Status Bling
curl http://localhost:3001/api/bling/status
```

---

## 📁 ESTRUTURA DO PROJETO

```
genesis-backend/
├── src/
│   ├── server.js              ← Servidor principal (porta 3001)
│   ├── services/
│   │   ├── motor.js           ← Motor NCT + RAST-HASH + iRollo v3.0
│   │   ├── bling.js           ← Bling API v3 real (OAuth2)
│   │   └── gemini.js          ← Google Gemini Flash (enriquecimento)
│   ├── routes/
│   │   ├── produtos.js        ← CRUD produtos + enriquecimento
│   │   ├── motor.js           ← NCT, hash, lote, título SEO
│   │   └── massa.js           ← Upload CSV, envio em lote
│   └── test-bling.js          ← Script de teste
├── public/
│   └── index.html             ← Frontend (coloque o genesis-irollo-360.html aqui)
├── .env                       ← Credenciais (NÃO commitar no git!)
├── firebase.json              ← Config deploy Firebase
└── package.json
```

---

## ⚠️ SEGURANÇA

1. **NUNCA** commite o arquivo `.env` no Git
2. Adicione `.env` no `.gitignore`
3. No Firebase, use `firebase functions:config:set`
4. O `BLING_CLIENT_SECRET` não foi preenchido — obtenha em: Bling > App > Seu App

---

## 📞 SUPORTE

**MOBIS Peças Automotivas**  
mobispecas@gmail.com  
Genesis iRollo v3.0 — Motor de Indexação Determinística
