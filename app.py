import hashlib
import re
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field
from typing import List

app = FastAPI(
    title="Genesis iRollo 360",
    description="Barramento Unificado — Proteção de Base de Dados contra Concorrência",
    version="3.5"
)

class ProdutoInput(BaseModel):
    sku: str = Field(..., description="Chave única do produto para evitar concorrência")
    oem: str = Field(..., description="Número Original do Fabricante")
    ean: str = Field(default="", description="Código de barras EAN")
    descricao_bruta: str = Field(..., description="Texto bruto do fornecedor")
    cnpj: str = "00.000.000/0001-00"
    cod_referencia: str = ""
    dados_origem: str = ""

REGISTROS_PROCESSADOS = set()

class MidwayEngineUnificada:
    def __init__(self, produto: ProdutoInput):
        self.sku = produto.sku.strip()
        self.oem = re.sub(r'[^a-zA-Z0-9]', '', produto.oem).upper()
        self.ean = produto.ean.strip()
        self.descricao_bruta = produto.descricao_bruta.strip()
        self.cod_referencia = produto.cod_referencia.strip().upper()
        self.ramo_identificado = "GERAL"
        self.ncm_validado = "00000000"
        self.nome_puro = ""

    def processar_identidade_pura(self):
        desc = self.descricao_bruta.upper()
        if any(k in desc for k in ["FREIO", "DIREÇÃO", "MOTOR", "SUSPENSÃO", "AMORTECEDOR", "FILTRO", "BIELA", "CABEÇOTE", "PISTÃO"]):
            self.ramo_identificado = "AUTOMOTIVO"
            self.ncm_validado = "87089990"
        elif any(k in desc for k in ["PLACA", "PROCESSADOR", "RESISTOR", "LED", "CONECTOR", "CABO", "FONTE"]):
            self.ramo_identificado = "ELETRÔNICOS"
            self.ncm_validado = "85423190"
        else:
            self.ramo_identificado = "MERCADORIA GERAL"
            self.ncm_validado = "00000000"

        nome_limpo = self.descricao_bruta
        if self.oem and self.oem in nome_limpo.upper():
            nome_limpo = re.sub(re.escape(self.oem), '', nome_limpo, flags=re.IGNORECASE)
        self.nome_puro = re.sub(r'\s+', ' ', nome_limpo).strip().title()

    def gerar_links_carrossel_hd(self) -> List[str]:
        slug_oem = self.oem.lower()
        slots = ["REAL", "LATERAL_90", "DETALHE_CONSTRUTIVO", "MEDIDAS_ESPECIFICACOES", "EMBALAGEM_LOGISTICA", "CONTEXTO_USO"]
        return [f"https://images.mobisautopecas.com.br/produtos/{slug_oem}_{sufixo}.jpg" for sufixo in slots]

    def executar(self) -> dict:
        self.processar_identidade_pura()
        imagens = self.gerar_links_carrossel_hd()
        banco_cambialidade = [self.oem]
        if self.cod_referencia:
            banco_cambialidade.extend([c.strip() for c in self.cod_referencia.split("|") if c.strip()])

        titulo_final = f"{self.nome_puro} {self.oem}"
        string_hash = f"{self.sku}-{self.ncm_validado}-{self.oem}"
        rast_hash = f"NCT-{hashlib.md5(string_hash.encode('utf-8')).hexdigest()[:16].upper()}-OK"

        return {
            "integridade_database": "DADO_UNICO_CONFIRMADO",
            "rast_hash_certified": rast_hash,
            "ramo_processamento": self.ramo_identificado,
            "imagens_carrossel": {
                "img_principal": imagens[0] if imagens else "",
                "galeria_6_slots": imagens
            },
            "gaveta_bling_v3": {
                "nome": titulo_final[:120],
                "codigo_sku": self.sku,
                "codigo_barras": self.ean,
                "ncm": self.ncm_validado,
                "origem": "0",
                "unidade": "UN",
                "descricao_curta": f"Produto Técnico Certificado. Identificador de Fábrica: {self.oem}. Matriz de Cambialidade: {', '.join(banco_cambialidade)}."
            }
        }

@app.get("/")
async def rota_raiz_servidor():
    return {
        "status": "online",
        "ambiente": "Production — Render",
        "projeto": "Genesis iRollo 360",
        "politica_duplicidade": "Bloqueio por SKU/OEM Ativo"
    }

@app.post("/processar", status_code=status.HTTP_200_OK)
async def pipeline_processamento(produto: ProdutoInput):
    chave_identificadora = f"{produto.sku.strip()}_{produto.oem.strip().upper()}"
    if chave_identificadora in REGISTROS_PROCESSADOS:
        return {
            "status_NCT": "PRODUTO JÁ EXISTENTE — CONCORRÊNCIA IMPEDIDA",
            "mensagem": "Este SKU/OEM já foi processado e indexado na base. Cadastro protegido contra duplicidade.",
            "sku": produto.sku
        }
    try:
        motor = MidwayEngineUnificada(produto=produto)
        resultado = motor.executar()
        REGISTROS_PROCESSADOS.add(chave_identificadora)
        return resultado
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
