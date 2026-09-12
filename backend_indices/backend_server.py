import ee
from pydantic import BaseModel
from fastapi import FastAPI, status, HTTPException, BackgroundTasks
from datetime import date
import logging
from processar_lavouras import processar_todas_lavouras, processar_lavoura
from georreferencia import criar_geometria
from gee_auth import inicializar_ee
from threading import Lock

_processamento_lock = Lock()
from dotenv import load_dotenv
load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")



class Day_req(BaseModel):
    coordenadas: list[list[float]]
    usuario_id: int
    lavoura_id: int
    
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
        geometria = criar_geometria(day_req.coordenadas, ordem='lnglat')
        resultado = processar_lavoura({'id':day_req.lavoura_id,'usuarioId':day_req.usuario_id}, geometria=geometria)
        if resultado['status'] == 'sem_dados':
            raise HTTPException(status_code=422, detail=resultado)
        if resultado['status'] == 'erro':
            raise HTTPException(status_code=502, detail=resultado)
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