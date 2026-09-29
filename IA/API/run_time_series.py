from serie_temporal import make_time_series 
from gee_auth import inicializar_ee
from fastapi import FastAPI, HTTPException  
from pydantic import BaseModel
from typing import List, Tuple
from datetime  import date
from contextlib import asynccontextmanager
from georreferencia import criar_geometria
class Req(BaseModel):
    coordenadas: List[Tuple[float, float]]
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
   
 