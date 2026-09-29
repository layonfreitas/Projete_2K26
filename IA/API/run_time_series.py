from contextlib import asynccontextmanager
from datetime import date

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from serie_temporal import make_time_series
from gee_auth import inicializar_ee
from georreferencia import criar_geometria


class Ponto(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class Req(BaseModel):
    coordenadas: list[Ponto] = Field(min_length=3)
    dataInicio: date
    dataFim: date
    usuarioId: int
    lavouraId: int
    ano: int
    crs: str
    crsTransform: list[float] = Field(
        min_length=6,
        max_length=6,
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    inicializar_ee()
    yield


app = FastAPI(lifespan=lifespan)


@app.post("/time_series")
def run_time_series(req: Req):
    if req.dataInicio > req.dataFim:
        raise HTTPException(
            status_code=422,
            detail="A data inicial não pode ser posterior à final.",
        )

    try:
        coordenadas = [
            {"lat": ponto.lat, "lng": ponto.lng}
            for ponto in req.coordenadas
        ]

        geometria = criar_geometria(coordenadas)

        resposta = make_time_series(
            geometria,
            req.dataInicio.isoformat(),
            req.dataFim.isoformat(),
            req.usuarioId,
            req.lavouraId,
            req.ano,
            req.crs,
            req.crsTransform,
        )

        return resposta

    except Exception as erro:
        raise HTTPException(
            status_code=400,
            detail=str(erro),
        ) from erro