"""Z-score robusto dentro da lavoura; máscara e grade herdadas do índice."""
import math
import ee
from get_indices import SemDadosValidos, exportar_png, save_image_indatabase

PALETA = ['93c5fd','fbbf24','dc2626','86efac','166534']
ROTULOS = ['Faixa central (−2 a 2)','Baixo (−3,5 a −2)','Muito baixo (< −3,5)',
           'Alto (2 a 3,5)','Muito alto (> 3,5)']


def calcular_z_score(indice,geometria):
    banda = indice.bandNames().getInfo()[0]
    parametros = dict(geometry=geometria,crs=indice.projection(),scale=10,maxPixels=1e8)
    mediana = indice.reduceRegion(reducer=ee.Reducer.median(),**parametros).getInfo().get(banda)
    if mediana is None or not math.isfinite(float(mediana)):
        raise SemDadosValidos('Z-score: não há pixels válidos nesta data.')
    diferenca = indice.subtract(mediana)
    mad = diferenca.abs().reduceRegion(reducer=ee.Reducer.median(),**parametros).getInfo().get(banda)
    if mad is None or not math.isfinite(float(mad)) or mad <= 1e-9:
        raise SemDadosValidos('Z-score indisponível: variação insuficiente (MAD zero). Use o índice original.')
    z = diferenca.multiply(0.6745).divide(mad)
    # Não inicia com ee.Image(0), que tem grade e footprint próprios.
    classes = (indice.multiply(0).add(1)
        .where(z.lt(-2).And(z.gte(-3.5)),2).where(z.lt(-3.5),3)
        .where(z.gt(2).And(z.lte(3.5)),4).where(z.gt(3.5),5)
        .updateMask(z.mask()).clip(geometria))
    return classes, {'mediana':mediana,'mad':mad}


def salvar_mapa_z_score(imagem,nome_indice,usuario_id,lavoura__id,geometria,pasta_id=None):
    classes,estatisticas = calcular_z_score(imagem.select(nome_indice),geometria)
    conteudo,meta = exportar_png(classes.visualize(min=1,max=5,palette=PALETA),
        geometria,usuario_id,lavoura__id,imagem)
    meta['visualizacao'] = {'tipo':'zscore','palette':PALETA,'rotulos':ROTULOS,**estatisticas}
    data = imagem.date().format('YYYY-MM-dd').getInfo()
    return save_image_indatabase(conteudo,f'z-score-{nome_indice}_{data}',pasta_id,
        usuario_id,lavoura__id,data,None,meta)
