import math
import ee
from get_indices import SemDadosValidos, exportar_png, save_image_indatabase
import s3fs
import numpy as np
import xarray as xr
import requests

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

    url = f"{usuario_id}/{lavoura_id}/{indice}_zscore.zarr"

    with fs.open(url, "rb") as f:

        ds = xr.open_zarr(f, consolidated=False)

        filtros = (
            (ds["safra"] != safra_atual)
            & (ds["graus_dia"] >= graus_dia - 50)
            & (ds["graus_dia"] <= graus_dia + 50)
        )

        historico = ds["z_score"].where(filtros, drop=True)

        if historico.sizes.get("tempo", 0) == 0:
            raise SemDadosValidos(
                f"Não há histórico válido para {indice} "
                f"na faixa de graus-dia informada."
            )

        # Mediana espacial do histórico
        mediana = historico.median(dim="tempo", skipna=True)

        # MAD do histórico (em torno da mediana)
        mad = (
            (historico - mediana)
            .abs()
            .median(dim="tempo", skipna=True)
        )

        mad_valido = mad > 0

        # Diferença entre a cena atual e a mediana histórica
        diferenca = (z_scores_espacial - mediana).abs()

        z_score_final = (
            0.6745
            * diferenca
            / mad
        ).where(mad_valido)

        return z_score_final.rename("z_score_final")


def ee_image_para_xarray(
    z_score_ee,
    indice,
    geometria,
    dimensoes=(1024, 1024)
):

    params = {
        'crs': 'EPSG:3857',
        'dimensions': list(dimensoes),
        'format': 'NUMPY_NDARRAY'
    }

    url = z_score_ee.clip(geometria).getThumbURL(params)

    resp = requests.get(url, timeout=(15, 180))

    resp.raise_for_status()

    z_np = np.load(io.BytesIO(resp.content))

    # Garante 2D (y, x)
    if z_np.ndim == 3 and z_np.shape[0] == 1:
        z_np = z_np[0]

    if z_np.ndim != 2:
        raise ValueError(
            f"Esperado array 2D (y, x), obtido shape {z_np.shape}"
        )

    z_xr = xr.DataArray(
        z_np,
        dims=['y', 'x'],
        name=f'z_{indice}'
    )

    return z_xr