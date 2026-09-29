from serie_temporal import make_time_series 
from gee_auth import inicializar_ee
from fastapi import FastAPI, HTTPException  
from pydantic import BaseModel, Field
from typing import List
from datetime  import date
from contextlib import asynccontextmanager
from georreferencia import criar_geometria
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

    geometria = criar_geometria(req.coordenadas)
    resposta =  make_time_series(geometria, req.dataInicio, req.dataFim, req.usuarioId, req.lavouraID, req.ano, req.crs, req.crsTransform )
    return resposta

   except Exception as e:
           raise HTTPException(status_code=400, detail=str(e))
   
 