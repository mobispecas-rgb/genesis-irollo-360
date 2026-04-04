<p align="center">
  <img src="https://img.shields.io/badge/Motor-iRollo%20v3.0-blue?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Status-Online-brightgreen?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Node.js-18%2B-green?style=for-the-badge&logo=node.js" />
  <img src="https://img.shields.io/badge/Bling-API%20v3-orange?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Gemini-Flash-purple?style=for-the-badge&logo=google" />
</p>

<h1 align="center">⚙️ Genesis iRollo 360</h1>
<h3 align="center">Plataforma de Gestão de Catálogo de Autopeças — MOBIS</h3>

<p align="center">
  Backend Node.js que integra <strong>Bling ERP</strong>, <strong>Wix Studio</strong> e <strong>WhatsApp Bot com IA (Gemini Flash)</strong><br/>
  para gestão, enriquecimento e indexação determinística de autopeças.
</p>

---

## 📋 Índice

- [Visão Geral](#-visão-geral)
- [Arquitetura](#-arquitetura)
- [Módulos (17 seções)](#-módulos-17-seções)
- [Motor iRollo v3.0](#-motor-irollo-v30)
- [Instalação](#-instalação)
- [Configuração do .env](#-configuração-do-env)
- [Endpoints da API](#-endpoints-da-api)
- [Formato CSV](#-formato-csv)
- [Deploy Firebase](#-deploy-firebase)
- [Bugs Conhecidos](#-bugs-conhecidos)
- [Segurança](#-segurança)
- [Suporte](#-suporte)

---

## 🎯 Visão Geral

O **Genesis iRollo 360** é uma plataforma completa para a MOBIS Peças Automotivas que centraliza:

| Integração | Função |
|---|---|
| 🔗 **Bling ERP** | Criação, listagem e enriquecimento de produtos via API v3 OAuth2 |
| 🌐 **Wix Studio** | Frontend do catálogo público de autopeças |
| 🤖 **WhatsApp Bot** | Atendimento automatizado com IA |
| 🧠 **Gemini Flash** | Enriquecimento de títulos, descrições e compatibilidades |
| 📊 **Motor NCT** | Score de qualidade determinístico por produto |

---

## 🏗️ Arquitetura

```
genesis-backend/
├── src/
│   ├── server.js              ← Servidor principal (porta 3001)
│   ├── services/
│   │   ├── motor.js           ← Motor NCT + RAST-HASH + iRollo v3.0
│   │   ├── bling.js           ← Bling API v3 (OAuth2 + refresh token)
│   │   └── gemini.js          ← Google Gemini Flash (enriquecimento IA)
│   ├── routes/
│   │   ├── produtos.js        ← CRUD produtos + enriquecimento
│   │   ├── motor.js           ← NCT, hash, lote, título SEO
│   │   └── massa.js           ← Upload CSV, envio em lote
│   └── test-bling.js          ← Script de teste de conexão
├── public/
│   └── index.html             ← Frontend (genesis-irollo-360.html)
├── .env                       ← Credenciais (NÃO commitar!)
├── firebase.json              ← Config deploy Firebase
└── package.json
```

---

## 🗂️ Módulos (17 seções)

O app usa **display show/hide** para simular navegação — todas as páginas existem no DOM, apenas uma fica visível por vez.

| # | Módulo | Descrição |
|---|---|---|
| 1 | **Dashboard** | Visão geral com KPIs e status das integrações |
| 2 | **Catálogo** | Listagem e busca de produtos no Bling |
| 3 | **Cadastro Manual** | Formulário de cadastro individual com validação NCT |
| 4 | **Upload em Massa** | Import CSV com parse + score NCT em lote |
| 5 | **Envio Bling** | Aprovação e envio do lote validado ao ERP |
| 6 | **Motor NCT** | Calculadora de score de qualidade por OEM |
| 7 | **Enriquecimento IA** | Gemini Flash para títulos SEO e descrições |
| 8 | **RAST-HASH** | Geração de hash determinística por produto |
| 9 | **Compatibilidades** | Mapeamento OEM × veículo × ano |
| 10 | **WhatsApp Bot** | Config e logs do bot de atendimento |
| 11 | **Wix Sync** | Sincronização do catálogo com Wix Studio |
| 12 | **Bling Status** | Monitor de conexão OAuth2 e token |
| 13 | **Fornecedores** | Gestão de fornecedores e referências cruzadas |
| 14 | **NCM / OEM** | Tabelas de NCM e codificações OEM |
| 15 | **Relatórios** | Exportação de dados e histórico de operações |
| 16 | **Configurações** | Ajustes de ambiente, marca padrão e NCT mínimo |
| 17 | **Logs** | Console de logs do servidor em tempo real |

---

## 🧠 Motor iRollo v3.0

O **Motor iRollo** é o núcleo do sistema — calcula o **NCT (Normalized Catalog Trust)**, um score de 0 a 1 que determina se um produto está apto para publicação.

```
NCT mínimo padrão: 0.90
Marca padrão:      TRIMGO
```

### Como funciona o NCT

| Campo | Peso |
|---|---|
| OEM (código do fabricante) | Alto |
| NCM (código fiscal) | Alto |
| SKU padronizado | Médio |
| Nome/Descrição | Médio |
| Aplicação (veículo/ano) | Médio |
| Categoria | Baixo |

Produtos com NCT < 0.90 são **bloqueados** antes de chegar ao Bling.

---

## 🚀 Instalação

### Pré-requisitos

- Node.js 18+ instalado
- Credenciais Bling API v3 (OAuth2)
- Gemini API Key (gratuito em [aistudio.google.com/api-keys](https://aistudio.google.com/api-keys))

### Passo 1 — Clonar e instalar dependências

```bash
cd C:\genesis-backend
npm install
```

### Passo 2 — Configurar credenciais

```bash
notepad .env
```

### Passo 3 — Testar conexão

```bash
npm test
```

### Passo 4 — Iniciar servidor

```bash
npm run dev
# ou
node src/server.js
```

### Passo 5 — Confirmar

Acesse: [http://localhost:3001](http://localhost:3001)

Saída esperada:
```
╔══════════════════════════════════════════════╗
║  ⚙️  GENESIS iROLLO 360 — BACKEND ONLINE     ║
║  MOBIS Peças Automotivas                     ║
║  🌐 http://localhost:3001                    ║
║  📋 API: http://localhost:3001/api           ║
╚══════════════════════════════════════════════╝
Motor iRollo v3.0 ativo
```

---

## 🔑 Configuração do .env

```env
# ─── BLING OAuth2 ───────────────────────────────
BLING_CLIENT_ID=seu_client_id_aqui
BLING_CLIENT_SECRET=seu_client_secret_aqui
BLING_REFRESH_TOKEN=seu_refresh_token_aqui

# ─── GEMINI ─────────────────────────────────────
GEMINI_API_KEY=AIzaSy...

# ─── SERVIDOR ───────────────────────────────────
PORT=3001
NCT_MINIMO=0.90
MARCA_PADRAO=TRIMGO
```

> **Onde obter:**
> - **Bling** → bling.com.br → Configurações → API → Aplicativos
> - **Gemini** → aistudio.google.com/api-keys

---

## 📋 Endpoints da API

### 🧠 Motor iRollo

| Método | Endpoint | Descrição |
|---|---|---|
| POST | `/api/motor/nct` | Calcula NCT score + RAST-HASH |
| POST | `/api/motor/enriquecer` | Enriquece via Gemini + calcula NCT |

### 📦 Produtos Bling

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/produtos?limite=50` | Lista produtos do Bling |
| POST | `/api/produtos` | Valida NCT e cria produto no Bling |
| POST | `/api/produtos/:id/enriquecer` | Enriquece produto existente com Gemini |

### 🔗 Bling Auth

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/bling/status` | Testa conexão + token |
| POST | `/api/bling/token/renovar` | Renova access token via refresh token |
| GET | `/api/bling/buscar` | Busca produtos no Bling |

### 📊 Cadastro em Massa

| Método | Endpoint | Descrição |
|---|---|---|
| POST | `/api/massa/upload` | Upload CSV → parse + NCT em lote |
| POST | `/api/massa/enviar-bling` | Envia lote aprovado para o Bling |

```bash
# Exemplo — Calcular NCT
curl -X POST http://localhost:3001/api/motor/nct \
  -H "Content-Type: application/json" \
  -d '{"oem":"BDJ0430","ncm":"87089900","sku":"TRIMGO-BDJ0430","nome":"Bandeja Dianteira TRIMGO Honda Civic","aplicacao":"Honda Civic 2001-2006"}'
```

---

## 📄 Formato CSV

```csv
nome,oem,sku,ncm,preco,estoque,aplicacao,categoria,marca
Bandeja Dianteira Dir,BDJ0430,TRIMGO-BDJ0430,87089900,89.90,5,Honda Civic 2001,Suspensão,TRIMGO
Amortecedor Diant,AMR-001,TRIMGO-AMR001,87084000,245.00,3,Toyota Corolla 2003,Amortecedores,TRIMGO
```

**Variações aceitas nos cabeçalhos:**

| Campo | Aceita também |
|---|---|
| `nome` | `descricao`, `produto` |
| `oem` | `codigo_oem`, `mpn` |
| `sku` | `codigo`, `referencia` |
| `ncm` | `cod_ncm` |
| `preco` | `valor` |
| `aplicacao` | `veiculo`, `compatibilidade` |

---

## 🔥 Deploy no Firebase

```bash
npm install -g firebase-tools
firebase login
firebase init functions
firebase deploy
```

Após deploy: `https://genesis-irollo-360.web.app/api/`

---

## 🐛 Bugs Conhecidos

| Bug | Status | Solução |
|---|---|---|
| `[object Object]` na tabela | 🔧 Em correção | Corrigir `renderProdTabela` para acessar `produto.nome` |
| Toast Bling `[object Object]` | 🔧 Em correção | Trocar por `error.message` |
| Credenciais expostas no HTML | ⚠️ Crítico | Mover para `.env` |
| OEM com valor fixo no input | 🔧 Em correção | Trocar `value` por `placeholder` |
| Bling `invalid_client` | ❌ Bloqueante | Atualizar `BLING_CLIENT_SECRET` e `BLING_REFRESH_TOKEN` |
| Gemini erro 400 | ❌ Bloqueante | Atualizar `GEMINI_API_KEY` com chave ativa |

---

## 🔒 Segurança

- **NUNCA** commite o `.env` no Git
- Adicione `.env` ao `.gitignore`
- No Firebase, use: `firebase functions:config:set`
- Obtenha o `BLING_CLIENT_SECRET` em: Bling → App → Seu App

---

## 📞 Suporte

**MOBIS Peças Automotivas**
📧 mobispecas@gmail.com
🐙 [github.com/mobispecas-rgb](https://github.com/mobispecas-rgb)

---

<p align="center">
  <sub>Genesis iRollo v3.0 — Motor de Indexação Determinística © MOBIS 2025</sub>
</p>
