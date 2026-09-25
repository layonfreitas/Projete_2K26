# api_crs.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from contextlib import asynccontextmanager
from typing import List, Tuple
import ee

from gee_auth import inicializar_ee


class Coordenadas(BaseModel):
    # Lista de pares [longitude, latitude], fechando o polígono da lavoura
    coordenadas: List[Tuple[float, float]]


@asynccontextmanager
async def lifespan(app: FastAPI):
    inicializar_ee()
    yield


app = FastAPI(lifespan=lifespan)


@app.post("/crs")
async def obter_crs(dados: Coordenadas):
    try:
        colecao_nome = "COPERNICUS/S2_SR_HARMONIZED"  # ajuste pra coleção que vocês usam

        geometria = ee.Geometry.Polygon([dados.coordenadas])

        colecao = ee.ImageCollection(colecao_nome).filterBounds(geometria)
        primeira_imagem = colecao.first()

        primeira_banda = primeira_imagem.bandNames().get(0)
        projecao = primeira_imagem.select([primeira_banda]).projection().getInfo()

        return {
            "crs": projecao["crs"],
            "crs_transformation": projecao["transform"],
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))