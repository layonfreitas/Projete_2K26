import ee 
import google.auth
import geemap
import pandas as pd
import skfuzzy as fuzz
import numpy as np
from PIL import Image
from datetime import datetime
from skimage.measure import label
from scipy.ndimage import binary_dilation
import os 
from dotenv import load_dotenv
import cloudinary
from  get_indices import save_image_indatabase

load_dotenv()


cloudinary.config(
    cloud_name=os.environ.get("CLOUDINARY_CLOUD_NAME"),
    api_key=os.environ.get("CLOUDINARY_API_KEY"),
    api_secret=os.environ.get("CLOUDINARY_API_SECRET"),
    secure=True
)

from gee_auth import obter_credenciais

credentials, project_id = obter_credenciais()
ee.Initialize(credentials, project="projete2k26")


def add_NDVI(image):
    ndvi = image.normalizedDifference(["B8","B4"]).rename("NDVI")
    return image.addBands(ndvi)


def Imagem_para_zona_de_manejo(geometria, data_inicio, data_fim):
    inicio = ee.Date(data_inicio)
    fim = ee.Date(data_fim)

    colecao = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(geometria)
        .filterDate(inicio, fim)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 30))
    )

    colecao_ndvi = colecao.map(add_NDVI)

    media = colecao_ndvi.select("NDVI").mean().clip(geometria)
    desvio = colecao_ndvi.select("NDVI").reduce(ee.Reducer.stdDev()).clip(geometria)
    cv = desvio.divide(
    media.abs().max(0.001)
    ).multiply(100)

    proj = media.projection()

    coordenadas = ee.Image.pixelCoordinates(proj)

    mascara = (
    ee.Image.constant(0)
    .paint(geometria, 1)
    .And(cv.mask())
    .rename("mask")
)

    imagem_resumo = (
        media.rename("media")
        .addBands(cv.rename("CV"))
        .addBands(coordenadas.select("x"))
        .addBands(coordenadas.select("y"))
        .addBands(mascara.rename("mask"))
    )

    return geemap.ee_to_numpy(
        ee_object=imagem_resumo,
        region=geometria,
        scale=10
    )


def maioria(valores):
    valores = valores.astype(int)
    valores = valores[valores >= 0]

    if valores.size == 0:
        return -1

    return np.bincount(valores).argmax()


def remover_ilhas(mapa, min_pixels):
    mapa = mapa.copy()

    classes = np.unique(mapa)
    classes = classes[classes != 0]

    for classe in classes:

        mascara = mapa == classe

        componentes = label(
            mascara,
            connectivity=2
        )

        for comp in range(1, componentes.max() + 1):

            regiao = componentes == comp

            area = regiao.sum()

            if area >= min_pixels:
                continue

            borda = binary_dilation(regiao) & (~regiao)

            vizinhos = mapa[borda]

            vizinhos = vizinhos[
                vizinhos != 0
            ]

            vizinhos = vizinhos[
                vizinhos != classe
            ]

            if vizinhos.size == 0:
                continue

            nova_classe = np.bincount(vizinhos).argmax()

            mapa[regiao] = nova_classe

    return mapa

def create_zonas_de_manejo(array,usuario_id: int, lavoura_id: int,pasta_id = os.environ.get("MAPAS_INDICES_FOLDER"),  tamanho_min=0.5 ):

    linhas, colunas, bandas = array.shape

    dados = array[:, :, :4].reshape(-1, 4)

    mascara = (array[:, :, 4] == 1).reshape(-1)

    dados_validos = dados[mascara]

    dados_validos = dados_validos[
        np.all(np.isfinite(dados_validos), axis=1)
    ]

    if dados_validos.shape[0] < 10:
        raise ValueError(
            "Quantidade insuficiente de pixels válidos para clustering"
        )


    media = dados_validos.mean(axis=0)
    desvio = dados_validos.std(axis=0)

    desvio[desvio == 0] = 1

    dados_norm = (
        dados_validos - media
    ) / desvio


    resultados = []

    for k in range(2, 5):

        cntr, u, u0, d, jm, p, fpc = fuzz.cluster.cmeans(
            dados_norm.T,
            c=k,
            m=1.3,
            error=0.005,
            maxiter=1000
        )

        n = u.shape[1]

        fpi = 1 - (k / (k - 1)) * (
            1 - np.sum(u**2) / n
        )

        eps = 1e-10

        nce = (
            -np.sum(u * np.log(u + eps))
            /
            (n * np.log(k))
        )

        resultados.append(
            {
                "k": k,
                "fpi": fpi,
                "nce": nce
            }
        )


    df_resultados = pd.DataFrame(resultados)


    if (
        df_resultados["fpi"].max()
        ==
        df_resultados["fpi"].min()
    ):
        df_resultados["fpi_norm"] = 0

    else:

        df_resultados["fpi_norm"] = (
            df_resultados["fpi"]
            -
            df_resultados["fpi"].min()
        ) / (
            df_resultados["fpi"].max()
            -
            df_resultados["fpi"].min()
        )


    if (
        df_resultados["nce"].max()
        ==
        df_resultados["nce"].min()
    ):
        df_resultados["nce_norm"] = 0

    else:

        df_resultados["nce_norm"] = (
            df_resultados["nce"]
            -
            df_resultados["nce"].min()
        ) / (
            df_resultados["nce"].max()
            -
            df_resultados["nce"].min()
        )


    df_resultados["score_combinado"] = (
        df_resultados["fpi_norm"]
        +
        df_resultados["nce_norm"]
        +
        0.05 * df_resultados["k"]
    )


    k_otimo = int(
        df_resultados.loc[
            df_resultados["score_combinado"].idxmin(),
            "k"
        ]
    )


    cntr, u, u0, d, jm, p, fpc = fuzz.cluster.cmeans(
        dados_norm.T,
        c=k_otimo,
        m=1.3,
        error=0.005,
        maxiter=1000
    )


    zonas = np.argmax(u, axis=0)


    mapa = np.zeros(
        linhas * colunas,
        dtype=np.int32
    )

    mapa[mascara] = zonas + 1

    mapa = mapa.reshape(
        linhas,
        colunas
    )


    mapa_filtrado = mapa

    min_pixels = int(tamanho_min * 100)


    while True:

        novo = remover_ilhas(
            mapa_filtrado,
            min_pixels
        )

        if np.array_equal(
            novo,
            mapa_filtrado
        ):
            break

        mapa_filtrado = novo



    medias = cntr[:, 0]

    indices_cores = np.argsort(medias)


    cores = [
        (255, 0, 0),
        (255, 165, 0),
        (255, 255, 0),
        (144, 238, 144),
        (0, 128, 0)
    ]


    rgba = np.zeros(
        (linhas, colunas, 4),
        dtype=np.uint8
    )


    for i in range(k_otimo):

        rgba[
            mapa_filtrado == (indices_cores[i] + 1)
        ] = (
            *cores[i],
            255
        )


    mascara_imagem = mascara.reshape(
        linhas,
        colunas
    )


    rgba[~mascara_imagem] = [
        0,
        0,
        0,
        0
    ]


    nome_arquivo = (
        f"zonas_de_manejo_{datetime.now().strftime('%Y-%m-%d')}.png"
    )
    
    


    image_timeseries = Image.fromarray(rgba)
    save_image_indatabase(image_timeseries, nome_arquivo, pasta_id, usuario_id, lavoura_id, datetime.now().strftime('%Y-%m-%d'))