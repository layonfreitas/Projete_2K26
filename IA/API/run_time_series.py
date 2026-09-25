from serie_temporal import make_time_series 
from gee_auth import inicializar_ee
from fastapi import FastAPI, HTTPException  
from pydantic import BaseModel
from typing import List, Tuple
from datetime  import date
from contextlib import asynccontextmanager

class Req(BaseModel):
    geometria: List[Tuple[float, float]]
    data_inicio: date
    data_fim: date
    usuario_id : int
    lavoura_id : int
    ano: int
    crs: str
    crsTransform: list[float]



@asynccontextmanager
async def lifespan(app: FastAPI):
    inicializar_ee()
    yield


app = FastAPI(lifespan=lifespan)


app.post("/time_series")
def run_time_series(req: Req):
   try:
    resposta =  make_time_series(req.geometria, req.data_inicio, req.data_fim, req.usuario_id, req.lavoura_id, req.ano, req.crs, req.crsTransform )
    return resposta

   except Exception as e:
           raise HTTPException(status_code=400, detail=str(e))
   
 