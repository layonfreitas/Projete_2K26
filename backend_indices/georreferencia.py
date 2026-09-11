"""Contrato de exportação: PNG Web Mercator e limites em longitude/latitude."""
import math

import ee


def preparar_exportacao(geometria, usuario_id, lavoura_id):
    # O retângulo é compartilhado entre a exportação e o Leaflet.
    anel = geometria.bounds(maxError=1, proj="EPSG:4326").coordinates().getInfo()[0]
    oeste = min(p[0] for p in anel)
    sul = min(p[1] for p in anel)
    leste = max(p[0] for p in anel)
    norte = max(p[1] for p in anel)
    if not (-180 <= oeste < leste <= 180 and -85 < sul < norte < 85):
        raise ValueError("Limites incompatíveis com o mapa Web Mercator.")
    regiao = ee.Geometry.Rectangle(
        [oeste, sul, leste, norte], proj="EPSG:4326", geodesic=False
    )
    # Dimensões proporcionais à área projetada, sem rotação manual.
    largura = math.radians(leste - oeste)
    altura = (math.log(math.tan(math.pi / 4 + math.radians(norte) / 2))
              - math.log(math.tan(math.pi / 4 + math.radians(sul) / 2)))
    escala = 1024 / max(largura, altura)
    parametros = {
        "region": regiao,
        "crs": "EPSG:3857",
        "dimensions": f"{max(1, round(largura * escala))}x{max(1, round(altura * escala))}",
        "format": "png",
    }
    metadados = {
        "versao": 1,
        "crs": "EPSG:3857",
        "bounds": [[sul, oeste], [norte, leste]],
        "geometria": geometria.getInfo(),
        "usuarioId": int(usuario_id),
        "lavouraId": int(lavoura_id),
    }
    return parametros, metadados
