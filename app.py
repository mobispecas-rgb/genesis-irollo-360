import hashlib
import re
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field
from typing import List

app = FastAPI(
    title="Genesis iRollo 360",
    description="Barramento Mestre — Cross-Data e Otimização de CPC Google Ads",
    version="4.0"
)

MARCAS_AUTOPECAS = [
    "MERITOR", "NAKATA", "MAHLE", "METAL LEVE", "BOSCH", "MAGNETI MARELLI", "SABO", "FRAS-LE",
    "TRW", "COFAP", "VALEO", "DELPHI", "MONROE", "MTE-THOMSON", "CORTECO", "DAYCO", "CONTITECH",
    "REINZ", "ELRING", "TARANTO", "SPAAL", "TAKAO", "SCHADEK", "BROSOL", "URBA", "INDISA"
]

MONTADORAS_VEICULOS = {
    "VW": ["GOL", "FOX", "VOYAGE", "SAVEIRO", "AMAROK", "CONSTELLATION", "DELIVERY", "GOLF", "POLO"],
    "FIAT": ["UNO", "PALIO", "STRADA", "TORO", "DUCATO", "FIORINO", "CRONOS", "ARGO", "MOBI"],
    "CHEVROLET": ["ONIX", "PRISMA", "CELTA", "CORSA", "S10", "TRACKER", "CRUZE", "MONTANA"],
    "FORD": ["KA", "FIESTA", "ECOSPORT", "RANGER", "CARGO", "F1000"],
    "TOYOTA": ["COROLLA", "HILUX", "ETIOS", "YARIS", "SW4"],
    "HYUNDAI": ["HB20", "CRETA", "TUCSON", "I30", "IX35", "HR"],
    "RENAULT": ["SANDERO", "LOGAN", "DUSTER", "KWID", "MASTER", "OROCH"],
    "HONDA": ["CIVIC", "FIT", "CITY", "HR-V"],
    "VOLVO": ["VM", "FH", "NH"],
    "IVECO": ["DAILY", "STRALIS", "TECTOR"],
    "DAF": ["XF105", "XF", "CF"],
    "MERCEDES-BENZ": ["ACCELO", "ATEGO", "AXOR", "ACTROS", "SPRINTER"]
}

DICIONARIO_PRODUTOS = {
    "CABEÇOTE": {"ncm": "87089990", "peso": 14.50, "dimensoes": {"c": 55, "l": 25, "a": 20}},
    "ANEL": {"ncm": "73182900", "peso": 0.05, "dimensoes": {"c": 10, "l": 10, "a": 2}},
    "TRAVA": {"ncm": "73182900", "peso": 0.03, "dimensoes": {"c": 8, "l": 8, "a": 1}},
    "BIELA": {"ncm": "87089990", "peso": 1.20, "dimensoes": {"c": 22, "l": 8, "a": 5}},
    "FILTRO": {"ncm": "84212300", "peso": 0.40, "dimensoes": {"c": 12, "l": 12, "a": 15}},
    "AMORTECEDOR": {"ncm": "87088000", "peso": 3.80, "dimensoes": {"c": 60, "l": 15, "a": 15}},
    "JUNTA": {"ncm": "84841000", "peso": 0.25, "dimensoes": {"c": 50, "l": 30, "a": 2}},
    "PISTÃO": {"ncm": "84099190", "peso": 0.80, "dimensoes": {"c": 12, "l": 12, "a": 12}},
    "VALVULA": {"ncm": "84099110", "peso": 0.15, "dimensoes": {"c": 15, "l": 5, "a": 5}}
}

REGISTROS_PROCESSADOS = set()

class ProdutoInput(BaseModel):
    sku: str = Field(..., description="SKU Único da Mobis")
    oem: str = Field(..., description="OEM / Código do Fabricante")
    ean: str = Field(default="", description="Código de barras EAN-13")
    descricao_bruta: str = Field(..., description="Texto cru do fornecedor")
    cnpj: str = "00.000.000/0001-00"
    cod_referencia: str = ""
    dados_origem: str = ""

class MidwayMestreEngine:
    def __init__(self, produto: ProdutoInput):
        self.sku = produto.sku.strip()
        self.oem = re.sub(r'[^a-zA-Z0-9]', '', produto.oem).upper()
        self.ean = produto.ean.strip()
        self.descricao_bruta = produto.descricao_bruta.upper()
        self.cod_referencia = produto.cod_referencia.strip().upper()
        self.nome_peca = "COMPONENTE AUTOMOTIVO"
        self.marca_fabricante = "IMPORTADO MOBIS"
        self.montadora_aplicacao = "MULTIMARCAS"
        self.veiculo_aplicacao = "LINHA GERAL"
        self.ncm = "87089990"
        self.peso = 1.00
        self.dimensoes = {"c": 20, "l": 20, "a": 20}

    def processar_cross_data(self):
        for chave, dados in DICIONARIO_PRODUTOS.items():
            if chave in self.descricao_bruta:
                self.nome_peca = chave
                self.ncm = dados["ncm"]
                self.peso = dados["peso"]
                self.dimensoes = dados["dimensoes"]
                break
        for marca in MARCAS_AUTOPECAS:
            if marca in self.descricao_bruta:
                self.marca_fabricante = marca
                break
        encontrou_aplicacao = False
        for montadora, modelos in MONTADORAS_VEICULOS.items():
            if montadora in self.descricao_bruta:
                self.montadora_aplicacao = montadora
                for modelo in modelos:
                    if modelo in self.descricao_bruta:
                        self.veiculo_aplicacao = modelo
                        encontrou_aplicacao = True
                        break
            if encontrou_aplicacao:
                break

    def gerar_6_imagens_hd(self) -> List[str]:
        slug_oem = self.oem.lower()
        slots = ["REAL_FUNDO_BRANCO", "LATERAL_90_GRAUS", "DETALHE_TECNICO_PROXIMO", "MEDIDAS_E_ESPECIFICACOES", "EMBALAGEM_LOGISTICA", "APLICACAO_CONVENIADA"]
        return [f"https://images.mobisautopecas.com.br/produtos/{slug_oem}_{sufixo}.jpg" for sufixo in slots]

    def estruturar_gavetas(self) -> dict:
        self.processar_cross_data()
        imagens = self.gerar_6_imagens_hd()
        titulo_limpo = f"{self.nome_peca.title()} {self.oem} {self.marca_fabricante}"
        if self.veiculo_aplicacao != "LINHA GERAL":
            titulo_limpo += f" Aplicável em {self.montadora_aplicacao} {self.veiculo_aplicacao}"
        string_hash = f"{self.sku}-{self.ncm}-{self.oem}"
        rast_hash = f"NCT-{hashlib.md5(string_hash.encode('utf-8')).hexdigest()[:16].upper()}-OK"

        return {
            "integridade_database": "DADO_UNICO_CONFIRMADO",
            "status_NCT": "SINAL VERDE - LIBERADO",
            "rast_hash_certified": rast_hash,
            "nome_comercial_geral": titulo_limpo,
            "imagens_6_slots_hd": imagens,
            "gaveta_bling_v3": {
                "nome": titulo_limpo[:120],
                "codigo_sku": self.sku,
                "codigo_barras": self.ean,
                "ncm": self.ncm,
                "origem": "0",
                "unidade": "UN",
                "peso_liquido": self.peso,
                "peso_bruto": round(self.peso * 1.05, 2),
                "largura": self.dimensoes["l"],
                "altura": self.dimensoes["a"],
                "comprimento": self.dimensoes["c"],
                "descricao_curta": f"Componente Técnico Homologado. Código: {self.oem}. Fabricante: {self.marca_fabricante}. Aplicação técnica cruzada para {self.montadora_aplicacao} {self.veiculo_aplicacao}."
            },
            "gaveta_wix_studio": {
                "nome_produto": f"{titulo_limpo} — Linha Pura Certificada",
                "url_slug": re.sub(r'[^a-zA-Z0-9-]', '-', titulo_limpo.lower().replace(" ", "-")),
                "seo_title": f"{titulo_limpo} Original | Mobis Autopeças",
                "meta_description": f"Compre {titulo_limpo} com procedência garantida, dimensões oficiais e nota fiscal integral.",
                "peso_kg": self.peso,
                "galeria_imagens": imagens
            },
            "gaveta_google_shopping_ads": {
                "id": self.sku,
                "title": f"{titulo_limpo} - Envio Imediato",
                "mpn": self.oem,
                "gtin": self.ean if self.ean else "Sem Cód. Barras",
                "image_link": imagens[0],
                "additional_image_links": imagens[1:],
                "perfil_de_voz_ads": [
                    f"Onde comprar {self.nome_peca.lower()} do {self.veiculo_aplicacao.lower()} código {self.oem}",
                    f"{titulo_limpo[:30]}"
                ]
            }
        }

@app.get("/")
async def health_check():
    return {
        "status": "online",
        "ambiente": "Production — Render",
        "engine_version": "4.0 Mestre",
        "politica_duplicidade": "Bloqueio Anticoncorrência Ativo"
    }

@app.post("/processar", status_code=status.HTTP_200_OK)
async def pipeline_processamento(produto: ProdutoInput):
    chave_identificadora = f"{produto.sku.strip()}_{produto.oem.strip().upper()}"
    if chave_identificadora in REGISTROS_PROCESSADOS:
        return {
            "status_NCT": "PRODUTO JÁ EXISTENTE — CONCORRÊNCIA IMPEDIDA",
            "sku": produto.sku
        }
    try:
        motor = MidwayMestreEngine(produto=produto)
        resultado = motor.estruturar_gavetas()
        REGISTROS_PROCESSADOS.add(chave_identificadora)
        return resultado
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
