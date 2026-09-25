import json
import logging
import os
from datetime import date, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory

import ee
import numpy as np
import pandas as pd
import requests
import s3fs
import xarray as xr
from shapely.geometry import Polygon
from xee import helpers

from gee_auth import inicializar_ee
from georreferencia import criar_geometria, normalizar_coordenadas


log = logging.getLogger(__name__)

BANDAS = {
    "NDVI": ["B8", "B4"],
    "NDRE": ["B8", "B5"],
    "NDWI": ["B3", "B8"],
}


def graus_dia_periodo(lat, lon, inicio, fim):
    # Usa o arquivo histórico e complementa os dias recentes.
    corte = date.today() - timedelta(days=7)

    trechos = [
        (
            inicio,
            min(fim, corte),
            "https://archive-api.open-meteo.com/v1/archive",
        ),
        (
            max(inicio, corte + timedelta(days=1)),
            fim,
            "https://api.open-meteo.com/v1/forecast",
        ),
    ]

    valores = {}

    for a, b, url in trechos:
        if a > b:
            continue

        resposta = requests.get(
            url,
            params={
                "latitude": lat,
                "longitude": lon,
                "start_date": a.isoformat(),
                "end_date": b.isoformat(),
                "daily": "temperature_2m_max,temperature_2m_min",
                "timezone": "America/Sao_Paulo",
            },
            timeout=(10, 120),
        )
        resposta.raise_for_status()

        diario = resposta.json()["daily"]

        for dia, maxima, minima in zip(
            diario["time"],
            diario["temperature_2m_max"],
            diario["temperature_2m_min"],
        ):
            if maxima is None or minima is None:
                raise ValueError(
                    f"Temperatura indisponível em {dia}."
                )

            valores[pd.Timestamp(dia)] = max(
                0.0,
                (maxima + minima) / 2 - 10.0,
            )

    serie = pd.Series(valores, dtype=float).reindex(
        pd.date_range(inicio, fim)
    )

    if (
        serie.isna().any()
        or not np.isfinite(serie.to_numpy()).all()
    ):
        raise ValueError(
            "O clima retornou dias sem temperatura válida."
        )

    return serie.cumsum()


def padronizar_cena(cena):
    resultado = {}

    for indice in BANDAS:
        valores = cena[indice].transpose("y", "x")

        mediana = valores.median(skipna=True)

        mad = abs(
            valores - mediana
        ).median(skipna=True)

        # Se MAD for zero, mantém os resultados como indisponíveis.
        resultado[indice] = (
            0.6745
            * (valores - mediana)
            / mad.where(mad > 1e-9)
        ).astype("float32")

    return resultado


def gerar_series_safras(dados):
    obrigatorias = [
        "R2_BUCKET",
        "ENDPOINT_URL",
        "ACCESS_KEY_ID",
        "SECRET_ACCESS_KEY",
    ]

    faltando = [
        chave
        for chave in obrigatorias
        if not os.getenv(chave)
    ]

    if faltando:
        raise ValueError(
            "Configure: " + ", ".join(faltando)
        )

    inicializar_ee()

    pontos = normalizar_coordenadas(
        dados["coordenadas"]
    )

    geometria = criar_geometria(
        dados["coordenadas"]
    )

    poligono = Polygon(pontos)

    lon = poligono.centroid.x
    lat = poligono.centroid.y

    # Define uma grade UTM em metros para toda a lavoura.
    zona = min(
        60,
        max(1, int((lon + 180) // 6) + 1),
    )

    codigo_epsg = (
        32600 if lat >= 0 else 32700
    ) + zona

    crs = f"EPSG:{codigo_epsg}"

    grade = helpers.fit_geometry(
        poligono,
        grid_crs=crs,
        grid_scale=(10, -10),
    )

    def preparar(imagem):
        scl = imagem.select("SCL")

        mascara = (
            scl.eq(4)
            .Or(scl.eq(5))
            .Or(scl.eq(6))
            .Or(scl.eq(7))
        )

        limpa = imagem.updateMask(mascara)

        bandas = [
            limpa.normalizedDifference(par).rename(nome)
            for nome, par in BANDAS.items()
        ]

        return (
            ee.Image.cat(bandas)
            .clip(geometria)
            .copyProperties(
                imagem,
                ["system:time_start"],
            )
        )

    fs = s3fs.S3FileSystem(
        key=os.environ["ACCESS_KEY_ID"],
        secret=os.environ["SECRET_ACCESS_KEY"],
        client_kwargs={
            "endpoint_url": os.environ["ENDPOINT_URL"]
        },
    )

    base = (
        f"{os.environ['R2_BUCKET']}/"
        f"{dados['usuarioId']}/"
        f"{dados['id']}"
    )

    contagem = 0
    resumo = []

    # Monta os arquivos localmente antes de enviá-los ao R2.
    with TemporaryDirectory() as temporario:
        periodos = sorted(
            dados["safras"],
            key=lambda safra: safra["inicio"],
        )

        for safra in periodos:
            inicio = date.fromisoformat(
                safra["inicio"]
            )

            fim = date.fromisoformat(
                safra["fim"]
            )

            log.info(
                "SÉRIE lavoura=%s safra=%s início=%s fim=%s",
                dados["id"],
                safra["ano"],
                inicio,
                fim,
            )

            colecao = (
                ee.ImageCollection(
                    "COPERNICUS/S2_SR_HARMONIZED"
                )
                .filterBounds(geometria)
                .filterDate(
                    inicio.isoformat(),
                    (fim + timedelta(days=1)).isoformat(),
                )
                .filter(
                    ee.Filter.lt(
                        "CLOUDY_PIXEL_PERCENTAGE",
                        30,
                    )
                )
                .map(preparar)
                .sort("system:time_start")
            )

            quantidade = colecao.size().getInfo()
            salvos = 0

            if quantidade:
                gda = graus_dia_periodo(
                    lat,
                    lon,
                    inicio,
                    fim,
                )

                with xr.open_dataset(
                    colecao,
                    engine="ee",
                    **grade,
                    executor_kwargs={"max_workers": 2},
                ) as bruto:
                    renomear = {
                        "X": "x",
                        "Y": "y",
                        "lon": "x",
                        "lat": "y",
                    }

                    ds = bruto.rename({
                        origem: destino
                        for origem, destino in renomear.items()
                        if origem in bruto.dims
                    })

                    dias = pd.DatetimeIndex(
                        ds.time.values
                    ).normalize()

                    for dia in dias.unique().sort_values():
                        posicoes = np.flatnonzero(
                            dias == dia
                        )

                        # Combina observações do mesmo dia.
                        # Carrega um dia por vez para limitar a memória.
                        cena = (
                            ds.isel(time=posicoes)
                            .load()
                            .mean("time", skipna=True)
                        )

                        indices = padronizar_cena(cena)

                        tem_dados = any(
                            np.isfinite(valores.values).any()
                            for valores in indices.values()
                        )

                        if not tem_dados:
                            log.info(
                                "SÉRIE descartada: %s, "
                                "sem pixels válidos ou MAD zero",
                                dia.date(),
                            )
                            continue

                        for indice, valores in indices.items():
                            saida = (
                                valores
                                .rename("z_score")
                                .expand_dims(
                                    tempo=[dia.to_datetime64()]
                                )
                                .to_dataset()
                            )

                            saida = saida.assign_coords(
                                safra=(
                                    "tempo",
                                    np.array(
                                        [safra["ano"]],
                                        dtype="int32",
                                    ),
                                ),
                                graus_dia=(
                                    "tempo",
                                    [float(gda.loc[dia])],
                                ),
                            )

                            saida.attrs.update(
                                crs=crs,
                                crs_transform=list(
                                    grade["crs_transform"]
                                ),
                            )

                            caminho = (
                                Path(temporario)
                                / f"{indice}_zscore.zarr"
                            )

                            if contagem == 0:
                                saida.tempo.encoding.update(
                                    units="days since 1970-01-01",
                                    dtype="int64",
                                )

                                saida.to_zarr(
                                    str(caminho),
                                    mode="w",
                                    consolidated=False,
                                    zarr_format=2,
                                )
                            else:
                                saida.to_zarr(
                                    str(caminho),
                                    mode="a",
                                    append_dim="tempo",
                                    consolidated=False,
                                    zarr_format=2,
                                )

                        contagem += 1
                        salvos += 1

            resumo.append({
                **safra,
                "dias_salvos": salvos,
            })

            log.info(
                "SÉRIE safra=%s dias salvos=%s",
                safra["ano"],
                salvos,
            )

        if not contagem:
            raise ValueError(
                "Nenhuma safra teve pixels válidos "
                "para a série temporal."
            )

        arquivos = [
            caminho
            for caminho in Path(temporario).rglob("*")
            if caminho.is_file()
        ]

        fs.put(
            [str(caminho) for caminho in arquivos],
            [
                (
                    f"{base}/"
                    f"{caminho.relative_to(temporario).as_posix()}"
                )
                for caminho in arquivos
            ],
        )

        fs.pipe(
            f"{base}/serie_temporal_resumo.json",
            json.dumps(resumo).encode("utf-8"),
        )

    log.info(
        "SÉRIE CONCLUÍDA lavoura=%s dias=%s",
        dados["id"],
        contagem,
    )

    return resumo