import google.auth
import ee
import requests

credentials, project_id = google.auth.default()
ee.Initialize(credentials, project="projete2k26")

CESP = ee.FeatureCollection("projects/projete2k26/assets/Shape_SaoSeb_CESP").geometry()

cesp = ee.Geometry.Polygon(
       [
      [
        -47.12125183553667,
        -20.914678401110855
      ],
      [
        -47.12087364406557,
        -20.91455312673603
      ],
      [
        -47.12215113475975,
        -20.91155647843091
      ],
      [
        -47.12241667345222,
        -20.911488828872987
      ],
      [
        -47.1225212796038,
        -20.911533928581655
      ]
    ]
)

circulo = ee.Geometry.Polygon(
    [[-47.128682747679925,-20.913375590806897],[-47.12973417361376,-20.914959063640662],[-47.13003458102343,-20.9162218211294],[-47.129905834990716,-20.917564742026084],[-47.12891825400964,-20.91936408666854],[-47.127104967282946,-20.920566387514505],[-47.12584969346398,-20.92077683996215],[-47.12351080720299,-20.92036595633726],[-47.1228456193673,-20.919925006803858],[-47.121901481794055,-20.91915334199897],[-47.12108650037666,-20.917511951253836],[-47.121037658584136,-20.916210642921254],[-47.121590800193694,-20.914155188299873],[-47.123092837242034,-20.91278217064744],[-47.12523662204091,-20.91220411947541],[-47.12716781253163,-20.912524826690298],[-47.127854458039444,-20.913166239062257]]
)

def get_indices_image(geometria, data_alvo, janela, nuvem_maxima):
    data_inicio = ee.Date(data_alvo).advance(-janela, "day")
    data_fim = ee.Date(data_alvo).advance(janela, "day")

    colecao = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(geometria)
        .filterDate(data_inicio, data_fim)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", nuvem_maxima))
        .sort("CLOUDY_PIXEL_PERCENTAGE")
    )

    imagem = ee.Image(colecao.first())
    scl = imagem.select("SCL")
    mascara = (
        scl.neq(3)
        .And(scl.neq(8))
        .And(scl.neq(9))
        .And(scl.neq(10))
        .And(scl.gt(0))
    )

    # b5_10m = (
    #     imagem.select("B5")
    #     .resample("bilinear")
    #     .reproject(crs=imagem.select("B4").projection(), scale=10)
    # )

    ndvi = imagem.normalizedDifference(["B8", "B4"]).rename("NDVI")
    ndre = imagem.normalizedDifference(["B8", "B5"]).rename("NDRE")
    ndwi = imagem.normalizedDifference(["B8", "B11"]).rename("NDWI")
#     ndre = (
#     imagem.select("B8")
#     .subtract(b5_10m)
#     .divide(imagem.select("B8").add(b5_10m))
#     .rename("NDRE")
# )

    return (
        imagem.addBands([ndvi, ndre,ndwi])
        .updateMask(mascara)
        .clip(geometria)
        .set("data_imagem", imagem.date().format("YYYY-MM-dd"))
    )


def save_indice_map(imagem, indice,geometria):
    data = imagem.date().format('YYYY-mm-dd').getInfo()
    nome_arquivo = indice + '_' + data + ".png"
    imagem_indice = imagem.select(indice)
    VisParams = {
            "min":0,
            "max":0.8,
            "palette": ['red', 'yellow', 'green']
    }

    if indice == "NDWI":
        VisParams = {
            "min": -0.5,
            "max": 0.4,
            "palette": ['red', 'yellow', 'green']
        }
    
    indiceColorido = imagem_indice.visualize(**VisParams)

    url_indice = indiceColorido.getThumbURL({
        "region": geometria,
        "dimensions": 1024,
        "format": "png"
    })

    response_indice = requests.get(url_indice)

    with open(nome_arquivo, "wb") as f:
        f.write(response_indice.content)
    
imagemHoje = get_indices_image(CESP, "2020-04-01",5 , 30)
