import math
import ee
from get_indices import SemDadosValidos, exportar_png, save_image_indatabase
import s3fs
import numpy as np
import xarray as xr
import requests
import io
import os

# A primeira cor não aparecerá, pois a classe 1 será transparente.
PALETA = ['000000', 'fbbf24', 'dc2626', '86efac', '166534']

ROTULOS = [
    'Faixa central (−2 a 2)',
    'Baixo (−3,5 a −2)',
    'Muito baixo (< −3,5)',
    'Alto (2 a 3,5)',
    'Muito alto (> 3,5)'
]


def calcular_z_score(indice, geometria):

    banda = indice.bandNames().getInfo()[0]

    parametros = dict(
        geometry=geometria,
        crs=indice.projection(),
        scale=10,
        maxPixels=1e8
    )

    mediana = indice.reduceRegion(
        reducer=ee.Reducer.median(),
        **parametros
    ).getInfo().get(banda)

    if mediana is None or not math.isfinite(float(mediana)):
        raise SemDadosValidos('Z-score: não há pixels válidos nesta data.')

    diferenca = indice.subtract(mediana)

    mad = diferenca.abs().reduceRegion(
        reducer=ee.Reducer.median(),
        **parametros
    ).getInfo().get(banda)

    if mad is None or not math.isfinite(float(mad)) or mad <= 1e-9:
        raise SemDadosValidos(
            'Z-score indisponível: variação insuficiente (MAD zero). Use o índice original.'
        )

    z = diferenca.multiply(0.6745).divide(mad)

    classes = (
        indice.multiply(0).add(1)
        .where(z.lt(-2).And(z.gte(-3.5)), 2)
        .where(z.lt(-3.5), 3)
        .where(z.gt(2).And(z.lte(3.5)), 4)
        .where(z.gt(3.5), 5)
        .updateMask(z.mask())
        .clip(geometria)
    )

    return z, classes, {'mediana': mediana, 'mad': mad}


def salvar_mapa_z_score(
    imagem,
    nome_indice,
    usuario_id,
    lavoura__id,
    geometria,
    pasta_id=None
):

    z_score_img, classes, estatisticas = calcular_z_score(
        imagem.select(nome_indice),
        geometria
    )

    # Deixa transparente somente a faixa central, correspondente à classe 1.
    classes_visuais = classes.updateMask(classes.neq(1))

    conteudo, meta = exportar_png(
        classes_visuais.visualize(
            min=1,
            max=5,
            palette=PALETA
        ),
        geometria,
        usuario_id,
        lavoura__id,
        imagem
    )

    meta['visualizacao'] = {
        'tipo': 'zscore',
        'palette': PALETA,
        'rotulos': ROTULOS,
        **estatisticas
    }

    data = imagem.date().format('YYYY-MM-dd').getInfo()

    registro = save_image_indatabase(
        conteudo,
        f'z-score-{nome_indice}_{data}',
        pasta_id,
        usuario_id,
        lavoura__id,
        data,
        None,
        meta
    )

    return registro, z_score_img


def calcular_zscore_historico(
    z_scores_espacial,
    indice,
    graus_dia,
    lavoura_id,
    usuario_id,
    safra_atual
):

    fs = s3fs.S3FileSystem(
        key=os.environ.get("ACCESS_KEY_ID"),
        secret=os.environ.get("SECRET_ACCESS_KEY"),
        client_kwargs={
            "endpoint_url": os.environ.get("ENDPOINT_URL")
        }
    )

    bucket = os.environ["R2_BUCKET"].strip("/")

    url = (
        f"{bucket}/{usuario_id}/{lavoura_id}/"
        f"{indice}_zscore.zarr"
    )

    store = fs.get_mapper(url)

    with xr.open_zarr(store, consolidated=False) as ds:

        outras_safras = ds["safra"].compute() != safra_atual

        gda_historico = ds["graus_dia"].compute().where(
            outras_safras,
            drop=True,
        )

        valores_gda = np.asarray(
            gda_historico.values,
            dtype=float,
        )
        valores_gda = valores_gda[np.isfinite(valores_gda)]

        print(
            f"[HISTÓRICO {indice}] "
            f"Atual: {graus_dia:.2f}; "
            f"faixa: {graus_dia - 50:.2f} "
            f"a {graus_dia + 50:.2f}",
            flush=True,
        )

        if valores_gda.size:
            mais_proximo = valores_gda[
                np.argmin(np.abs(valores_gda - graus_dia))
            ]

            print(
                f"[HISTÓRICO {indice}] "
                f"Mínimo: {valores_gda.min():.2f}; "
                f"máximo: {valores_gda.max():.2f}; "
                f"mais próximo: {mais_proximo:.2f}; "
                f"distância: {abs(mais_proximo - graus_dia):.2f}",
                flush=True,
            )
        else:
            print(
                f"[HISTÓRICO {indice}] "
                "Nenhum grau-dia válido de outra safra.",
                flush=True,
            )


        tolerancia = 100.0

        filtros = (
            (ds["safra"] != safra_atual)
            & (ds["graus_dia"] >= graus_dia - tolerancia)
            & (ds["graus_dia"] <= graus_dia + tolerancia)
        ).compute()

        historico = ds["z_score"].where(
            filtros,
            drop=True,
        )

        print(
            f"[HISTÓRICO {indice}] "
            f"Tolerância: ±{tolerancia:.0f}; "
            f"datas selecionadas: {historico.sizes.get('tempo', 0)}",
            flush=True,
        )
     

        quantidade = historico.sizes.get("tempo", 0)

        if quantidade < 2:
            raise SemDadosValidos(
                f"{indice}: apenas {quantidade} data(s) "
                "histórica(s) na faixa de graus-dia. "
                "Não é possível estimar a variação "
                "histórica com menos de duas datas."
            )

        # Mediana espacial do histórico
        mediana = historico.median(dim="tempo", skipna=True)

               # O MAD usa a distância absoluta em relação à mediana.
        mad = abs(historico - mediana).median(
            dim="tempo",
            skipna=True,
        )

        mad_valido = np.isfinite(mad) & (mad > 1e-9)

        # Preserva o sinal:
        # negativo = abaixo da mediana histórica;
        # positivo = acima da mediana histórica.
        atual, referencia = xr.align(
            z_scores_espacial,
            mediana,
            join="exact",
        )

        diferenca = atual - referencia

        z_score_final = (
            0.6745 * diferenca / mad.where(mad_valido)
        )

        return z_score_final.rename("z_score_final")


def ee_image_para_xarray(
    z_score_ee,
    indice,
    geometria,
):
    from shapely.geometry import Polygon
    from xee import helpers
    from georreferencia import normalizar_coordenadas

    # Reconstrói a mesma grade usada em serie_safras.py.
    pontos = normalizar_coordenadas(
        geometria.getInfo()
    )
    poligono = Polygon(pontos)

    lon = poligono.centroid.x
    lat = poligono.centroid.y

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

    # O tempo é apenas um índice temporário desta conversão.
    # A data real do mapa continua em resultado["dataImagem"].
    imagem = (
        z_score_ee
        .select([0])
        .rename("z_score")
        .clip(geometria)
        .set("system:time_start", 0)
    )

    colecao = ee.ImageCollection.fromImages([imagem])

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

        atual = (
            ds["z_score"]
            .isel(time=0, drop=True)
            .transpose("y", "x")
            .load()
            .astype("float32")
        )

    atual = atual.where(np.isfinite(atual))
    atual.name = f"z_{indice}"
    atual.attrs["crs"] = crs
    atual.attrs["crs_transform"] = list(
        grade["crs_transform"]
    )

    if not np.isfinite(atual.values).any():
        raise SemDadosValidos(
            f"Z-score de {indice}: nenhum pixel válido."
        )

    print(
        f"[GRADE {indice}] "
        f"CRS={crs}; "
        f"linhas={atual.sizes['y']}; "
        f"colunas={atual.sizes['x']}",
        flush=True,
    )

    return atual