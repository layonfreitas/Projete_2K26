# api_crs.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from contextlib import asynccontextmanager
from typing import List
import ee
from gee_auth import inicializar_ee
import requests

class Ponto(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class Coordenadas(BaseModel):
    coordenadas: List[Ponto]


@asynccontextmanager
async def lifespan(app: FastAPI):
    inicializar_ee()
    yield


app = FastAPI(lifespan=lifespan)


@app.post("/crs")
async def obter_crs(dados: Coordenadas):
    try:
        colecao_nome = "COPERNICUS/S2_SR_HARMONIZED"  # ajuste pra coleção que vocês usam

        if len(dados.coordenadas) < 3:
            raise ValueError(
                "Informe pelo menos três pontos para o contorno."
            )

        # O Earth Engine recebe longitude primeiro e latitude depois.
        pontos = [
            [ponto.lng, ponto.lat]
            for ponto in dados.coordenadas
        ]

        # Fecha o contorno.
        if pontos[0] != pontos[-1]:
            pontos.append(pontos[0])

        geometria = ee.Geometry.Polygon(
            [pontos],
            proj="EPSG:4326",
        )
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