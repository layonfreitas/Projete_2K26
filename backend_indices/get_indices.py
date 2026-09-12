"""Seleção por cobertura na lavoura, renderização e gravação de mapas."""
from datetime import date
import io
import math
import os
import logging

import ee
import requests
import cloudinary
import cloudinary.uploader
from PIL import Image
from dotenv import load_dotenv
from georreferencia import preparar_exportacao
from gee_auth import inicializar_ee

load_dotenv()
log = logging.getLogger(__name__)
INDICES = ('NDVI','NDRE','NDWI')


class SemDadosValidos(ValueError):
    pass


def api_url(caminho):
    base = os.environ.get('DATABASE_URL','').rstrip('/')
    if not base: raise RuntimeError('DATABASE_URL não configurada.')
    return base+caminho


def adicionar_indices(imagem):
    scl = imagem.select('SCL')
    mascara = scl.gte(2).And(scl.neq(3)).And(scl.lt(8))
    ndvi = imagem.normalizedDifference(['B8','B4']).rename('NDVI')
    ndre = imagem.normalizedDifference(['B8','B5']).rename('NDRE')
    # Mantém a definição B8/B11 que o projeto já usa para NDWI.
    ndwi = imagem.normalizedDifference(['B8','B11']).rename('NDWI')
    clmi = imagem.select('B4').subtract(imagem.select('B2')).multiply(352).subtract(
        imagem.select('B8').subtract(imagem.select('B2')).multiply(175)).divide(2).rename('CLMI')
    return imagem.addBands([ndvi,ndre,ndwi,clmi]).updateMask(mascara)


def get_indices_image(geometria, data_alvo, janela=5, nuvem_maxima=100):
    inicializar_ee()
    date.fromisoformat(str(data_alvo))
    if janela < 0: raise ValueError('Janela de datas inválida.')
    inicio = ee.Date(str(data_alvo)).advance(-janela,'day')
    fim = ee.Date(str(data_alvo)).advance(janela+1,'day')
    colecao = (ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
               .filterBounds(geometria).filterDate(inicio,fim)
               .filter(ee.Filter.lte('CLOUDY_PIXEL_PERCENTAGE',nuvem_maxima))
               .sort('system:time_start',False))
    minimo = float(os.environ.get('MIN_COBERTURA_LAVOURA','0.65'))
    if not 0 < minimo <= 1: raise ValueError('MIN_COBERTURA_LAVOURA deve estar entre 0 e 1.')
    limite = max(1,int(os.environ.get('MAX_CENAS_AVALIADAS','60')))
    quantidade = min(colecao.size().getInfo(),limite)
    cenas = colecao.toList(quantidade) if quantidade else None
    for i in range(quantidade):
        original = ee.Image(cenas.get(i))
        imagem = adicionar_indices(original)
        # Conta também a área fora do footprint da cena como ausência de dados.
        valida = (imagem.select(list(INDICES)).mask().reduce(ee.Reducer.min())
                  .unmask(0,sameFootprint=False).rename('cobertura'))
        info = valida.reduceRegion(reducer=ee.Reducer.mean(),geometry=geometria,
            crs=original.select('B8').projection(),scale=10,maxPixels=1e8).getInfo()
        cobertura = info.get('cobertura') or 0
        if cobertura >= minimo:
            return (imagem.clip(geometria).set('cobertura_valida',cobertura)
                    .set('cena_id',original.get('system:index'))
                    .set('data_imagem',original.date().format('YYYY-MM-dd')))
        log.info('Cena descartada: %.1f%% da lavoura com dados válidos (mínimo %.1f%%).',cobertura*100,minimo*100)
    return None


def obter_valores_indices(imagem, geometria):
    return imagem.select([*INDICES,'CLMI']).reduceRegion(
        reducer=ee.Reducer.mean(),geometry=geometria,
        crs=imagem.select('NDVI').projection(),scale=10,maxPixels=1e8).getInfo()


def validar_png(conteudo, metadados):
    with Image.open(io.BytesIO(conteudo)) as png:
        if png.format != 'PNG': raise ValueError('A exportação não retornou um PNG.')
        if png.size != (metadados['largura'],metadados['altura']):
            raise ValueError('O PNG não possui as dimensões da grade geográfica.')
        rgba = png.convert('RGBA')
        dados = rgba.get_flattened_data() if hasattr(rgba, 'get_flattened_data') else rgba.getdata()
        pixels = [p for p in dados if p[3] > 0]
    if not pixels: raise SemDadosValidos('A exportação ficou totalmente transparente.')
    if all(min(p[:3]) >= 250 for p in pixels):
        raise SemDadosValidos('A exportação ficou totalmente branca; mapa não gravado.')
    return len(pixels)


def exportar_png(imagem_colorida, geometria, usuario_id, lavoura_id, imagem_origem):
    parametros,meta = preparar_exportacao(geometria,usuario_id,lavoura_id)
    # O PNG nasce com o recorte, projeção e máscara corretos no Earth Engine.
    url = imagem_colorida.clip(geometria).getThumbURL(parametros)
    resposta = requests.get(url,timeout=(15,180))
    resposta.raise_for_status()
    meta['pixelsVisiveis'] = validar_png(resposta.content,meta)
    detalhes = imagem_origem.toDictionary(['cena_id','cobertura_valida']).getInfo()
    meta.update({'cenaId':detalhes.get('cena_id'),
                 'coberturaValida':detalhes.get('cobertura_valida')})
    return resposta.content,meta


def save_image_indatabase(imagem,nome_arquivo,pasta_id,usuario_id,lavoura_id,
                          data_imagem,valor_indice=None,georreferencia=None):
    cloudinary.config(cloud_name=os.environ.get('CLOUDINARY_CLOUD_NAME'),
        api_key=os.environ.get('CLOUDINARY_API_KEY'),
        api_secret=os.environ.get('CLOUDINARY_API_SECRET'),secure=True)
    # PNG validado é enviado como bytes, preservando seu canal alpha.
    arquivo = io.BytesIO(imagem) if isinstance(imagem,bytes) else imagem
    response = cloudinary.uploader.upload(arquivo,
        public_id=f'usuario_{usuario_id}_lavoura_{lavoura_id}_{nome_arquivo}',
        folder=pasta_id or os.environ.get('MAPAS_INDICES_FOLDER') or 'mapas_indices',
        overwrite=True,invalidate=True,resource_type='image',format='png',timeout=180)
    dados = {'usuarioId':usuario_id,'lavouraId':lavoura_id,'dataImagem':data_imagem,
        'urlImagem':response['secure_url'],'indice':nome_arquivo.split('_')[0],
        'valorIndice':valor_indice,'georreferencia':georreferencia}
    resposta = requests.post(api_url('/imagens'),json=dados,timeout=(15,60))
    resposta.raise_for_status()
    log.info('Mapa salvo: lavoura %s / %s.',lavoura_id,nome_arquivo)
    return resposta.json()


def save_indice_valor(lavoura_id,tipo_indice,valor,data_referencia,imagem_id=None):
    if valor is None or not math.isfinite(float(valor)):
        raise SemDadosValidos(f'{tipo_indice}: não há valor numérico válido.')
    resposta = requests.post(api_url('/indices_vegetacao'),json={
        'lavouraId':lavoura_id,'imagemId':imagem_id,'tipoIndice':tipo_indice,
        'valor':valor,'dataReferencia':data_referencia},timeout=(15,60))
    resposta.raise_for_status()


def save_indice_map(imagem,indice,geometria,usuario_id,lavoura_id,valores_indices=None,pasta_id=None):
    if indice not in INDICES: raise ValueError('Índice não suportado pelo histórico.')
    valores = valores_indices if valores_indices is not None else obter_valores_indices(imagem,geometria)
    valor = valores.get(indice)
    if valor is None or not math.isfinite(float(valor)):
        raise SemDadosValidos(f'{indice}: a lavoura não possui pixels válidos.')
    vis = {'min':-0.5 if indice=='NDWI' else 0,
           'max':0.4 if indice=='NDWI' else 0.8,
           'palette':['d73027','fee08b','1a9850']}
    conteudo,meta = exportar_png(imagem.select(indice).visualize(**vis),geometria,usuario_id,lavoura_id,imagem)
    meta['visualizacao'] = {'tipo':'indice',**vis}
    data = imagem.date().format('YYYY-MM-dd').getInfo()
    salvo = save_image_indatabase(conteudo,f'{indice}_{data}',pasta_id,usuario_id,lavoura_id,data,valor,meta)
    save_indice_valor(lavoura_id,indice,valor,data,imagem_id=salvo.get('id'))
    return salvo
