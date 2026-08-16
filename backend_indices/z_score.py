import ee
import google.auth
import requests
import os

credentials, project_id = google.auth.default()
ee.Initialize(credentials, project="projete2k26")

def salvar_mapa_z_score(imagem, nome_indice, geometria, pasta_saida="."):

    indice = imagem.select(nome_indice)

    mediana = indice.reduceRegion(
        reducer=ee.Reducer.median(),
        geometry=geometria,
        scale=10,
        maxPixels=1e9
    )

    imagem_mediana = mediana.toImage(indice.bandNames())

    desvio_absoluto = indice.subtract(imagem_mediana).abs()

    mad = desvio_absoluto.reduceRegion(
        reducer=ee.Reducer.median(),
        geometry=geometria,
        scale=10,
        maxPixels=1e9
    )

    imagem_mad = mad.toImage(indice.bandNames())

    z_score = indice.subtract(imagem_mediana).multiply(0.6745).divide(imagem_mad)

    z_score_classificado = ee.Image(0)

    z_score_classificado = z_score_classificado.where(
        z_score.gte(-2).And(z_score.lte(2)),
        1
    )

    z_score_classificado = z_score_classificado.where(
        z_score.lt(-2).And(z_score.gte(-3.5)),
        2
    )

    z_score_classificado = z_score_classificado.where(
        z_score.lt(-3.5),
        3
    )

    z_score_classificado = z_score_classificado.where(
        z_score.gt(2).And(z_score.lte(3.5)),
        4
    )

    z_score_classificado = z_score_classificado.where(
        z_score.gt(3.5),
        5
    )

    parametros_visualizacao = {
        "min": 1,
        "max": 5,
        "palette": [
            "ffffff",
            "fff176",
            "d50000",
            "81c784",
            "1b5e20"
        ]
    }

    imagem_visualizacao = (
        z_score_classificado
        .clip(geometria)
        .visualize(**parametros_visualizacao)
    )

    data_imagem = ee.Date(imagem.get("system:time_start")).format("yyyy-MM-dd").getInfo()

    nome_arquivo = f"z_score_{nome_indice}_{data_imagem}.png"

    url = imagem_visualizacao.getThumbURL({
        "region": geometria,
        "dimensions": 1024,
        "format": "png"
    })

    resposta = requests.get(url)

    caminho = os.path.join(pasta_saida, nome_arquivo)

    with open(caminho, "wb") as arquivo:
        arquivo.write(resposta.content)

    return caminho
