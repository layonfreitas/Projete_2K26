from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from contextlib import asynccontextmanager
from graus_dia import get_graus_dia_data
from datetime import date

class Req(BaseModel):
    lat: float
    lon: float
    dataInicio: date
    dataFim : date


app = FastAPI()

@app.post("/gda_to_js")
def get_gda(req: Req):
    try:
        graus_dia = get_graus_dia_data(req.lat, req.lon, req.dataInicio, req.dataFim)
        return {"gda": graus_dia}

    except Exception as e:
        raise HTTPException(status_code= 500, detail= str(e))
