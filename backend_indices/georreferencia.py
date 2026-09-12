"""PNG com grade explícita em Web Mercator e contorno histórico."""
import json
import math

RAIO = 6378137.0
VERSAO_MAPA = 2


def normalizar_coordenadas(coordenadas, ordem='latlng'):
    """Cadastro: objetos lat/lng ou pares lat/lng. GeoJSON: lng/lat explícito."""
    if isinstance(coordenadas, str):
        coordenadas = json.loads(coordenadas)
    if isinstance(coordenadas, dict):
        if coordenadas.get('type') != 'Polygon':
            raise ValueError('A geometria deve ser um Polygon.')
        if len(coordenadas.get('coordinates', [])) != 1:
            raise ValueError('Este cadastro aceita um único contorno, sem furos.')
        coordenadas, ordem = coordenadas['coordinates'][0], 'lnglat'
    pontos = []
    for p in coordenadas:
        if isinstance(p, dict):
            lng, lat = float(p['lng']), float(p['lat'])
        elif ordem == 'lnglat':
            lng, lat = map(float, p)
        else:
            lat, lng = map(float, p)
        if not (math.isfinite(lng) and math.isfinite(lat) and -180 <= lng <= 180 and -85 < lat < 85):
            raise ValueError('Coordenada inválida para o mapa.')
        if not pontos or pontos[-1] != [lng, lat]:
            pontos.append([lng, lat])
    if len(pontos) > 1 and pontos[0] == pontos[-1]:
        pontos.pop()
    if len({tuple(p) for p in pontos}) < 3:
        raise ValueError('A lavoura precisa de três pontos diferentes.')
    if max(p[0] for p in pontos) - min(p[0] for p in pontos) > 180:
        raise ValueError('Contorno cruza o antimeridiano.')
    # Não reordena vértices: uma área cruzada precisa ser corrigida no cadastro.
    def orient(a,b,c):
        return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    n = len(pontos)
    for i in range(n):
        a,b = pontos[i],pontos[(i+1)%n]
        for j in range(i+1,n):
            if j == (i+1)%n or (j+1)%n == i: continue
            c,d = pontos[j],pontos[(j+1)%n]
            if orient(a,b,c)*orient(a,b,d) <= 0 and orient(c,d,a)*orient(c,d,b) <= 0:
                if max(min(a[0],b[0]),min(c[0],d[0])) <= min(max(a[0],b[0]),max(c[0],d[0])) and max(min(a[1],b[1]),min(c[1],d[1])) <= min(max(a[1],b[1]),max(c[1],d[1])):
                    raise ValueError('O contorno da lavoura tem linhas cruzadas; corrija os pontos no cadastro.')
    x0,y0 = pontos[0]
    area = sum((pontos[i][0]-x0)*(pontos[(i+1)%n][1]-y0)-(pontos[(i+1)%n][0]-x0)*(pontos[i][1]-y0) for i in range(n))
    if abs(area) < 1e-14:
        raise ValueError('O contorno não possui área.')
    return pontos


def criar_geometria(coordenadas, ordem='latlng'):
    import ee
    pontos = normalizar_coordenadas(coordenadas, ordem)
    return ee.Geometry.Polygon([pontos], proj='EPSG:4326', geodesic=False)


def preparar_exportacao(geometria, usuario_id, lavoura_id):
    geojson = geometria.getInfo()
    pontos = normalizar_coordenadas(geojson)
    oeste,sul = min(p[0] for p in pontos),min(p[1] for p in pontos)
    leste,norte = max(p[0] for p in pontos),max(p[1] for p in pontos)
    def projetar(lng,lat):
        return RAIO*math.radians(lng), RAIO*math.log(math.tan(math.pi/4+math.radians(lat)/2))
    left,bottom = projetar(oeste,sul)
    right,top = projetar(leste,norte)
    dx,dy = right-left,top-bottom
    if dx <= 0 or dy <= 0: raise ValueError('Limites sem área.')
    escala = 1024 / max(dx,dy)
    width,height = max(1,round(dx*escala)),max(1,round(dy*escala))
    affine = [dx/width,0,left,0,-dy/height,top]
    # Com crs_transform + duas dimensions, o cliente EE extrai exatamente
    # esse retângulo. Não combinar com region: isso provocaria outro resize.
    parametros = {'crs':'EPSG:3857','crs_transform':affine,
                  'dimensions':[width,height],'format':'png'}
    metadados = {'versao':VERSAO_MAPA,'crs':'EPSG:3857',
                'bounds':[[sul,oeste],[norte,leste]],
                'geometria':{'type':'Polygon','coordinates':[pontos+[pontos[0]]]},
                'usuarioId':int(usuario_id),'lavouraId':int(lavoura_id),
                'largura':width,'altura':height,'transformacao':affine}
    return parametros,metadados
