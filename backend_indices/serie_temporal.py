import ee 
import google.auth
import numpy as np
import os 
from dotenv import load_dotenv
from graus_dia import get_graus_dia_data
from z_score import calcular_z_score
import requests
import xarray as xr
import s3fs
import time



load_dotenv()


credentials_r2 = {
    "access_key_id": os.environ.get("ACCESS_KEY_ID"),
    "secret_access_key": os.environ.get("SECRET_ACCESS_KEY"),
    "client_kwargs": { "endpoint_url": os.environ.get("ENDPOINT_URL")}
}

indices = ["NDVI", "NDRE", "NDWI"]



def add_NDVI_zscore(image):
    ndvi = image.normalizedDifference(["B8","B4"]).rename("NDVI")
    z_score,_,_ = calcular_z_score(ndvi, image.geometry())
    return image.addBands(z_score.rename("NDVI_zscore"))

def add_NDRE_zscore(image):
    ndre = image.normalizedDifference(["B8","B5"]).rename("NDRE")
    z_score,_,_ = calcular_z_score(ndre, image.geometry())
    return image.addBands(z_score.rename("NDRE_zscore"))

def add_NDWI_zscore(image):
    ndwi = image.normalizedDifference(["B3","B8"]).rename("NDWI")
    z_score,_,_ = calcular_z_score(ndwi, image.geometry())
    return image.addBands(z_score.rename("NDWI_zscore"))    
   

def make_time_series(
    geometria,
    data_inicio,
    data_fim,
    usuario_id: int,
    lavoura_id: int,
    ano: int,
    crs,
    crsTransform,
    *,
    reiniciar=False,
):
    import logging
    from datetime import date, timedelta

    import pandas as pd
    from shapely.geometry import shape
    from xee import helpers

    from gee_auth import inicializar_ee

    # Reaproveita apenas o cálculo climático.
    # NÃO chama gerar_series_safras.
    from serie_safras import graus_dia_periodo

    log = logging.getLogger(__name__)

    obrigatorias = [
        "R2_BUCKET",
        "ENDPOINT_URL",
        "ACCESS_KEY_ID",
        "SECRET_ACCESS_KEY",
    ]

    faltando = [
        nome for nome in obrigatorias
        if not os.getenv(nome)
    ]

    if faltando:
        raise ValueError(
            "Variáveis ausentes: " + ", ".join(faltando)
        )

    inicio = date.fromisoformat(data_inicio)
    fim = date.fromisoformat(data_fim)

    if inicio > fim:
        raise ValueError("A data inicial é posterior à final.")

    inicializar_ee()

    # O endpoint já fornece uma geometria do Earth Engine.
    lavoura = ee.Geometry(geometria)
    poligono = shape(lavoura.getInfo())

    if len(crsTransform) != 6:
        raise ValueError("crsTransform precisa ter 6 números.")

    escala_x = abs(float(crsTransform[0]))
    escala_y = -abs(float(crsTransform[4]))

    if escala_x == 0 or escala_y == 0:
        raise ValueError("A resolução da grade não pode ser zero.")

    # Ajusta a extensão da grade ao contorno da lavoura.
    grade = helpers.fit_geometry(
        poligono,
        grid_crs=crs,
        grid_scale=(escala_x, escala_y),
    )

    bandas = {
        "NDVI": ["B8", "B4"],
        "NDRE": ["B8", "B5"],
        "NDWI": ["B3", "B8"],
    }

    def preparar(imagem):
        scl = imagem.select("SCL")

        mascara = (
            scl.eq(4)
            .Or(scl.eq(5))
            .Or(scl.eq(6))
            .Or(scl.eq(7))
        )

        limpa = imagem.updateMask(mascara)

        calculadas = [
            limpa.normalizedDifference(par).rename(nome)
            for nome, par in bandas.items()
        ]

        return (
            ee.Image.cat(calculadas)
            .clip(lavoura)
            .copyProperties(imagem, ["system:time_start"])
        )

    imagens = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(lavoura)
        .filterDate(
            inicio.isoformat(),
            (fim + timedelta(days=1)).isoformat(),
        )
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 30))
        .map(preparar)
        .sort("system:time_start")
    )

    if imagens.size().getInfo() == 0:
        raise ValueError(
            f"Nenhuma imagem encontrada para a safra {ano}."
        )

    graus_dia = graus_dia_periodo(
        poligono.centroid.y,
        poligono.centroid.x,
        inicio,
        fim,
    )

    fs = s3fs.S3FileSystem(
        key=os.environ["ACCESS_KEY_ID"],
        secret=os.environ["SECRET_ACCESS_KEY"],
        client_kwargs={
            "endpoint_url": os.environ["ENDPOINT_URL"],
        },
    )

    bucket = os.environ["R2_BUCKET"].strip("/")
    base = f"{bucket}/{usuario_id}/{lavoura_id}"

    caminhos = {
        indice: f"{base}/{indice}_zscore.zarr"
        for indice in bandas
    }

    # Sem reiniciar, acrescenta às séries existentes.
    existentes = {
        indice: fs.exists(f"{caminho}/.zgroup")
        for indice, caminho in caminhos.items()
    }

    # Impede acrescentar novamente datas já gravadas.
    if not reiniciar:
        for indice, caminho in caminhos.items():
            if existentes[indice]:
                with xr.open_zarr(
                    fs.get_mapper(caminho),
                    consolidated=False,
                ) as anterior:
                    datas = pd.DatetimeIndex(
                        anterior.tempo.values
                    )

                    if len(datas) and inicio <= datas.max().date():
                        raise ValueError(
                            f"A série {indice} já contém datas "
                            f"até {datas.max().date()}. "
                            "Reprocesse as safras em ordem cronológica."
                        )

    dias_salvos = 0

    log.info(
        "[SERIE] make_time_series: lavoura=%s safra=%s",
        lavoura_id,
        ano,
    )

    with xr.open_dataset(
        imagens,
        engine="ee",
        **grade,
        executor_kwargs={"max_workers": 2},
    ) as bruto:
        nomes = {
            "X": "x",
            "Y": "y",
            "lon": "x",
            "lat": "y",
        }

        ds = bruto.rename({
            origem: destino
            for origem, destino in nomes.items()
            if origem in bruto.dims
        })

        dias = pd.DatetimeIndex(ds.time.values).normalize()

        for dia in dias.unique().sort_values():
            posicoes = np.flatnonzero(dias == dia)

            # Carrega apenas um dia por vez.
            cena = (
                ds.isel(time=posicoes)
                .load()
                .mean("time", skipna=True)
            )

            padronizados = {}

        for dia in dias.unique().sort_values():
            posicoes = np.flatnonzero(dias == dia)

            # Carrega apenas um dia por vez.
            t0 = time.perf_counter()
            cena = (
                ds.isel(time=posicoes)
                .load()
                .mean("time", skipna=True)
            )
            log.info(
                "[SERIE] %s: GEE %.1fs",
                dia.date(),
                time.perf_counter() - t0,
            )

            padronizados = {}

            for indice in bandas:
                valores = cena[indice].transpose("y", "x")
                mediana = valores.median(skipna=True)
                mad = abs(valores - mediana).median(skipna=True)

                padronizados[indice] = (
                    0.6745
                    * (valores - mediana)
                    / mad.where(mad > 1e-9)
                ).astype("float32")

            if not any(
                np.isfinite(valores.values).any()
                for valores in padronizados.values()
            ):
                log.info(
                    "[SERIE] Dia descartado: %s; "
                    "sem pixels válidos ou MAD zero.",
                    dia.date(),
                )
                continue

            for indice, valores in padronizados.items():
                saida = (
                    valores.rename("z_score")
                    .expand_dims(tempo=[dia.to_datetime64()])
                    .to_dataset()
                    .assign_coords(
                        graus_dia=(
                            "tempo",
                            [float(graus_dia.loc[dia])],
                        ),
                        safra=(
                            "tempo",
                            np.array([ano], dtype="int32"),
                        ),
                    )
                )

                saida.attrs.update(
                    crs=crs,
                    crs_transform=list(grade["crs_transform"]),
                )

                criar = (
                    reiniciar and dias_salvos == 0
                ) or not existentes[indice]

                opcoes = {
                    "mode": "w" if criar else "a",
                    "consolidated": False,
                    "zarr_format": 2,
                }

                if criar:
                    saida.tempo.encoding.update(
                        units="days since 1970-01-01",
                        dtype="int64",
                    )
                else:
                    opcoes["append_dim"] = "tempo"

                t1 = time.perf_counter()
                saida.to_zarr(
                    fs.get_mapper(caminhos[indice]),
                    **opcoes,
                )
                log.info(
                    "[SERIE] %s %s: R2 %.1fs",
                    dia.date(),
                    indice,
                    time.perf_counter() - t1,
                )

                existentes[indice] = True

            dias_salvos += 1

            if not any(
                np.isfinite(valores.values).any()
                for valores in padronizados.values()
            ):
                log.info(
                    "[SERIE] Dia descartado: %s; "
                    "sem pixels válidos ou MAD zero.",
                    dia.date(),
                )
                continue

            for indice, valores in padronizados.items():
                saida = (
                    valores.rename("z_score")
                    .expand_dims(tempo=[dia.to_datetime64()])
                    .to_dataset()
                    .assign_coords(
                        graus_dia=(
                            "tempo",
                            [float(graus_dia.loc[dia])],
                        ),
                        safra=(
                            "tempo",
                            np.array([ano], dtype="int32"),
                        ),
                    )
                )

                saida.attrs.update(
                    crs=crs,
                    crs_transform=list(grade["crs_transform"]),
                )

                criar = (
                    reiniciar and dias_salvos == 0
                ) or not existentes[indice]

                opcoes = {
                    "mode": "w" if criar else "a",
                    "consolidated": False,
                    "zarr_format": 2,
                }

                if criar:
                    saida.tempo.encoding.update(
                        units="days since 1970-01-01",
                        dtype="int64",
                    )
                else:
                    opcoes["append_dim"] = "tempo"

                saida.to_zarr(
                    fs.get_mapper(caminhos[indice]),
                    **opcoes,
                )

                existentes[indice] = True

            dias_salvos += 1

    if dias_salvos == 0:
        raise ValueError(
            f"A safra {ano} não teve dias válidos para salvar."
        )

    log.info(
        "[SERIE] Salva no R2: lavoura=%s safra=%s dias=%s",
        lavoura_id,
        ano,
        dias_salvos,
    )

    return {
        "status": "concluido",
        "lavouraId": lavoura_id,
        "ano": ano,
        "dias_salvos": dias_salvos,
        "arquivos": list(caminhos.values()),
    }