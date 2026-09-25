import ee
import os
import secrets
import logging
from pydantic import BaseModel, Field, model_validator
from fastapi import FastAPI, status, HTTPException, BackgroundTasks, Header
from datetime import date
from processar_lavouras import processar_todas_lavouras, processar_lavoura
from georreferencia import criar_geometria
from gee_auth import inicializar_ee
from threading import Lock



_processamento_lock = Lock()
from dotenv import load_dotenv
load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")


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
            raise ValueError("O ano da safra não pode estar no futuro.")

        if not date(2017, 3, 28) <= self.inicio <= self.fim <= date.today():
            raise ValueError(
                "Informe um período entre 28/03/2017 e hoje."
            )

        return self


class Day_req(BaseModel):
    coordenadas: list[Coordenada]
    usuario_id: int
    lavoura_id: int
    safras: list[SafraReq] = Field(default_factory=list, max_length=30)

    @model_validator(mode="after")
    def validar_safras(self):
        periodos = sorted(self.safras, key=lambda safra: safra.inicio)

        anos = [safra.ano for safra in periodos]

        if len(anos) != len(set(anos)):
            raise ValueError("Há anos de safra repetidos.")

        for anterior, atual in zip(periodos, periodos[1:]):
            if atual.inicio <= anterior.fim:
                raise ValueError("Os períodos das safras se sobrepõem.")

        self.safras = periodos
        return self
    
class Zona_de_manejo_req(BaseModel):
    coordenadas: list[list[float]]
    data_inicio: date
    data_fim: date
    usuario_id: int
    lavoura_id: int
    tamanho_min: float


indices = ["NDVI", "NDRE", "NDWI"]

app = FastAPI()

@app.get("/health", status_code=status.HTTP_200_OK)
async def health():

    return {"status": "ok"}


    





@app.post("/day_maps/")
def create_day_maps(day_req: Day_req):
    # Mantém o contrato desta rota: pares [longitude, latitude].
    if not _processamento_lock.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="Já há um processamento em andamento neste serviço.")
    try:
        inicializar_ee()
        coordenadas = [
        [p.lng, p.lat]
        for p in day_req.coordenadas
    ]
        geometria = criar_geometria(coordenadas, ordem='lnglat')
        resultado = processar_lavoura({'id':day_req.lavoura_id,'usuarioId':day_req.usuario_id, 'coordenadas': coordenadas}, geometria=geometria)
        print('geometria processada.')
        if resultado['status'] == 'sem_dados':
            raise HTTPException(status_code=422, detail=resultado)
        if resultado['status'] == 'erro':
            raise HTTPException(status_code=502, detail=resultado)

        print(resultado)
        return resultado
    finally:
        _processamento_lock.release()


def _processar_em_segundo_plano():
    try:
        processar_todas_lavouras()
    finally:
        _processamento_lock.release()


@app.post("/processar_todas_lavouras/", status_code=202)
def processar_todas(background_tasks: BackgroundTasks):
    if not _processamento_lock.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="Já há um processamento em andamento neste serviço.")
    background_tasks.add_task(_processar_em_segundo_plano)
    return {"status":"aceito","mensagem":"Processamento iniciado; acompanhe os resultados nos logs do backend."}


@app.post("/get_zona_de_manejo/", status_code=status.HTTP_201_CREATED)
async def zonas_de_manejo(zona_de_manejo_req: Zona_de_manejo_req):
    inicializar_ee()
    from serie_temporal import Imagem_para_zona_de_manejo, create_zonas_de_manejo
    geometria = ee.Geometry.Polygon(zona_de_manejo_req.coordenadas)
    usuario_id = zona_de_manejo_req.usuario_id
    lavoura_id = zona_de_manejo_req.lavoura_id
    array = Imagem_para_zona_de_manejo(geometria, zona_de_manejo_req.data_inicio.isoformat(), zona_de_manejo_req.data_fim.isoformat())
    arquivo = create_zonas_de_manejo(array = array,usuario_id= usuario_id, lavoura_id= lavoura_id, tamanho_min= zona_de_manejo_req.tamanho_min )
    return{
        "status": "sucesso",
        "mensagem": "Zonas de manejo criadas.",
        "arquivo": arquivo
    }
def _gerar_mapas_agendados(dados):
    try:
        if dados.get("safras"):
            try:
                from serie_safras import gerar_series_safras

                resultado_series = gerar_series_safras(dados)

                logging.info(
                    "Resultado das séries da lavoura %s: %s",
                    dados["id"],
                    resultado_series,
                )

            except Exception:
                logging.exception(
                    "Falha na série temporal da lavoura %s",
                    dados["id"],
                )

        # Uma falha na série não impede a tentativa de gerar os mapas.
        try:
            resultado = processar_lavoura(dados)

            logging.info(
                "Resultado dos mapas da lavoura %s: %s",
                dados["id"],
                resultado,
            )

        except Exception:
            logging.exception(
                "Erro ao gerar mapas da lavoura %s",
                dados["id"],
            )

    finally:
        _processamento_lock.release()

@app.post("/agendar_mapas/", status_code=202)
def agendar_mapas(
    day_req: Day_req,
    background_tasks: BackgroundTasks,
    x_mapas_token: str = Header(default=""),
):
    # Confere a senha enviada pelo backend do banco.
    token_esperado = os.getenv("MAPAS_INTERNAL_TOKEN", "")

    if (
        not token_esperado
        or not secrets.compare_digest(
            x_mapas_token,
            token_esperado,
        )
    ):
        raise HTTPException(
            status_code=401,
            detail="Credencial interna inválida.",
        )

    dados = {
    "id": day_req.lavoura_id,
    "usuarioId": day_req.usuario_id,
    "coordenadas": [
        {"lat": ponto.lat, "lng": ponto.lng}
        for ponto in day_req.coordenadas
    ],
    "safras": [
        safra.model_dump(mode="json")
        for safra in day_req.safras
    ],
}

    # Confere os pontos antes de aceitar a geração.
    from georreferencia import normalizar_coordenadas

    try:
        normalizar_coordenadas(dados["coordenadas"])

    except ValueError as erro:
        raise HTTPException(
            status_code=422,
            detail=str(erro),
        ) from erro

    # Reutiliza a trava que seu projeto já possui.
    if not _processamento_lock.acquire(blocking=False):
        raise HTTPException(
            status_code=409,
            detail="Já existe um processamento em andamento.",
        )

    background_tasks.add_task(
        _gerar_mapas_agendados,
        dados,
    )

    return {
        "status": "aceito",
        "lavouraId": day_req.lavoura_id,
    }