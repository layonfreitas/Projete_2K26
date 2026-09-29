from serie_temporal import make_time_series 
from gee_auth import inicializar_ee
from fastapi import FastAPI, HTTPException  
from pydantic import BaseModel, Field
from typing import List
from datetime  import date
from contextlib import asynccontextmanager
from georreferencia import criar_geometria
import ee 

class Ponto(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)

class Req(BaseModel):
    coordenadas: List[Ponto]
    dataInicio: date
    dataFim: date
    usuarioId : int
    lavouraId : int
    ano: int
    crs: str
    crsTransform: list[float]






@asynccontextmanager
async def lifespan(app: FastAPI):
    inicializar_ee()
    yield


app = FastAPI(lifespan=lifespan)


@app.post("/time_series")
def run_time_series(req: Req):
   try:
    if len(dados.coordenadas) < 3:
            raise ValueError("Informe pelo menos três pontos para o contorno.")

        # O Earth Engine recebe longitude primeiro e latitude depois.
    pontos = [[ponto.lng, ponto.lat]
            for ponto in dados.coordenadas
        ]

        # Fecha o contorno.
    if pontos[0] != pontos[-1]:
            pontos.append(pontos[0])

    geometria = ee.Geometry.Polygon(
                [pontos],
                proj="EPSG:4326",
            )
    resposta =  make_time_series(geometria, req.dataInicio, req.dataFim, req.usuarioId, req.lavouraID, req.ano, req.crs, req.crsTransform )
    return resposta

   except Exception as e:
           raise HTTPException(status_code=400, detail=str(e))
   
 