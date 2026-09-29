import ee
import os
import secrets
import logging
import requests
import faulthandler

from datetime import date
from threading import Lock

from pydantic import BaseModel, Field, model_validator
from fastapi import FastAPI, status, HTTPException, Header

from georreferencia import criar_geometria
from gee_auth import inicializar_ee
from processar_lavouras import processar_lavoura

from dotenv import load_dotenv


load_dotenv()


faulthandler.enable()

faulthandler.dump_traceback_later(
    60,
    repeat=False,
)


print(
    "[INICIO] Carregando backend_server",
    flush=True,
)


logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s %(message)s",
)


log = logging.getLogger(__name__)


_processamento_lock = Lock()


class Coordenada(BaseModel):
    lat: float
    lng: float


class SafraReq(BaseModel):
    ano: int = Field(ge=2017)
    inicio: date
    fim: date

    @model_validator(mode="after")
    def validar_periodo(self):

        if self.ano > date.today().year:
            raise ValueError(
                "O ano da safra não pode estar no futuro."
            )

        if not date(2017, 3, 28) <= self.inicio <= self.fim <= date.today():
            raise ValueError(
                "Informe um período entre 28/03/2017 e hoje."
            )

        return self


class Day_req(BaseModel):
    coordenadas: list[Coordenada]
    usuario_id: int
    lavoura_id: int

    safras: list[SafraReq] = Field(
        default_factory=list,
        max_length=30,
    )

    @model_validator(mode="after")
    def validar_safras(self):

        periodos = sorted(
            self.safras,
            key=lambda safra: safra.inicio,
        )

        anos = [
            safra.ano
            for safra in periodos
        ]

        if len(anos) != len(set(anos)):
            raise ValueError(
                "Há anos de safra repetidos."
            )

        for anterior, atual in zip(
            periodos,
            periodos[1:],
        ):
            if atual.inicio <= anterior.fim:
                raise ValueError(
                    "Os períodos das safras se sobrepõem."
                )

        self.safras = periodos

        return self


class Zona_de_manejo_req(BaseModel):
    coordenadas: list[list[float]]
    data_inicio: date
    data_fim: date
    usuario_id: int
    lavoura_id: int
    tamanho_min: float


indices = [
    "NDVI",
    "NDRE",
    "NDWI",
]


app = FastAPI()


@app.get(
    "/health",
    status_code=status.HTTP_200_OK,
)
async def health():

    return {
        "status": "ok"
    }


def verificar_token(token):

    token_esperado = os.getenv(
        "MAPAS_INTERNAL_TOKEN",
        "",
    )

    if (
        not token_esperado
        or not secrets.compare_digest(
            token,
            token_esperado,
        )
    ):
        raise HTTPException(
            status_code=401,
            detail="Credencial interna inválida.",
        )


def encaminhar_fila(
    caminho,
    token,
    dados=None,
):

    verificar_token(token)

    base = os.getenv(
        "BANCO_API_URL",
        "",
    ).rstrip("/")

    if not base:
        raise HTTPException(
            status_code=503,
            detail="Configure BANCO_API_URL.",
        )

    try:

        resposta = requests.post(
            base + caminho,
            json=dados,
            headers={
                "X-Mapas-Token": os.getenv(
                    "MAPAS_INTERNAL_TOKEN",
                    "",
                ),
            },
            timeout=(5, 30),
        )

        if resposta.status_code != 202:

            log.error(
                "Banco recusou a entrada na fila: HTTP %s - %s",
                resposta.status_code,
                resposta.text[:500],
            )

            raise HTTPException(
                status_code=503,
                detail=(
                    "Não foi possível registrar "
                    "a geração."
                ),
            )

        return resposta.json()

    except HTTPException:
        raise

    except (
        requests.RequestException,
        ValueError,
    ) as erro:

        log.exception(
            "Erro ao encaminhar tarefa para o banco."
        )

        raise HTTPException(
            status_code=503,
            detail=(
                "Não foi possível confirmar "
                "a entrada na fila."
            ),
        ) from erro


@app.post(
    "/day_maps/",
    status_code=202,
)
@app.post(
    "/agendar_mapas/",
    status_code=202,
)
def agendar_mapas(
    day_req: Day_req,
    x_mapas_token: str = Header(
        default=""
    ),
):

    verificar_token(
        x_mapas_token
    )

    from georreferencia import (
        normalizar_coordenadas
    )

    dados = {
        "id": day_req.lavoura_id,

        "usuarioId": day_req.usuario_id,

        "coordenadas": [
            {
                "lat": ponto.lat,
                "lng": ponto.lng,
            }
            for ponto in day_req.coordenadas
        ],

        "safras": [
            safra.model_dump(
                mode="json"
            )
            for safra in day_req.safras
        ],

        "gerar_series": bool(
            day_req.safras
        ),
    }

    try:

        normalizar_coordenadas(
            dados["coordenadas"]
        )

    except ValueError as erro:

        raise HTTPException(
            status_code=422,
            detail=str(erro),
        ) from erro

    return encaminhar_fila(
        "/interno/mapas/enfileirar",
        x_mapas_token,
        {
            "lavoura_id": day_req.lavoura_id,
            "usuario_id": day_req.usuario_id,
        },
    )


@app.post(
    "/processar_todas_lavouras/",
    status_code=202,
)
def processar_todas(
    x_mapas_token: str = Header(
        default=""
    ),
):

    return encaminhar_fila(
        "/interno/mapas/enfileirar-todas",
        x_mapas_token,
    )


@app.post(
    "/get_zona_de_manejo/",
    status_code=status.HTTP_201_CREATED,
)
async def zonas_de_manejo(
    zona_de_manejo_req: Zona_de_manejo_req,
):

    inicializar_ee()

    from serie_temporal import (
        Imagem_para_zona_de_manejo,
        create_zonas_de_manejo,
    )

    geometria = ee.Geometry.Polygon(
        zona_de_manejo_req.coordenadas
    )

    usuario_id = (
        zona_de_manejo_req.usuario_id
    )

    lavoura_id = (
        zona_de_manejo_req.lavoura_id
    )

    array = Imagem_para_zona_de_manejo(
        geometria,
        zona_de_manejo_req.data_inicio.isoformat(),
        zona_de_manejo_req.data_fim.isoformat(),
    )

    arquivo = create_zonas_de_manejo(
        array=array,
        usuario_id=usuario_id,
        lavoura_id=lavoura_id,
        tamanho_min=zona_de_manejo_req.tamanho_min,
    )

    return {
        "status": "sucesso",
        "mensagem": "Zonas de manejo criadas.",
        "arquivo": arquivo,
    }


@app.post(
    "/processar_lavoura_direta/",
    status_code=202,
)
def processar_lavoura_direta(
    day_req: Day_req,
    x_mapas_token: str = Header(
        default=""
    ),
):

    verificar_token(
        x_mapas_token
    )

    if not _processamento_lock.acquire(
        blocking=False
    ):

        raise HTTPException(
            status_code=409,
            detail=(
                "Já há um processamento "
                "em andamento neste serviço."
            ),
        )

    try:

        inicializar_ee()

        coordenadas = [
            [
                ponto.lng,
                ponto.lat,
            ]
            for ponto in day_req.coordenadas
        ]

        geometria = criar_geometria(
            coordenadas,
            ordem="lnglat",
        )

        resultado = processar_lavoura(
            {
                "id": day_req.lavoura_id,
                "usuarioId": day_req.usuario_id,
                "coordenadas": coordenadas,
            },
            geometria=geometria,
        )

        if resultado["status"] == "sem_dados":

            raise HTTPException(
                status_code=422,
                detail=resultado,
            )

        if resultado["status"] == "erro":

            raise HTTPException(
                status_code=502,
                detail=resultado,
            )

        return resultado

    finally:

        _processamento_lock.release()


faulthandler.cancel_dump_traceback_later()


print(
    "[INICIO] backend_server carregado",
    flush=True,
)