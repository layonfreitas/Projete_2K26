import os
from datetime import date

import requests
import ee
import google.auth
from dotenv import load_dotenv

from get_indices import get_indices_image, save_indice_map
from z_score import salvar_mapa_z_score
from gee_auth import configurar_credenciais_google

load_dotenv()
configurar_credenciais_google()

credentials, project_id = google.auth.default()
ee.Initialize(credentials, project="projete2k26")

indices = ["NDVI", "NDRE", "NDWI"]


def buscar_todas_lavouras():
 
    url = os.environ.get("DATABASE_URL") + "/lavouras"
    resposta = requests.get(url, timeout=30)
    resposta.raise_for_status()
    return resposta.json()


def processar_lavoura(lavoura):

    usuario_id = lavoura["usuarioId"]
    lavoura_id = lavoura["id"]
    geometria = ee.Geometry.Polygon(lavoura["coordenadas"])

    imagem_hoje = get_indices_image(geometria, date.today().isoformat(), 5, 30)

    if imagem_hoje is None:
        print(f"  -> lavoura {lavoura_id}: nenhuma imagem válida encontrada hoje")
        return

    for indice in indices:
        save_indice_map(imagem_hoje, indice, geometria, usuario_id, lavoura_id)
        salvar_mapa_z_score(imagem_hoje, indice, usuario_id, lavoura_id, geometria)

    print(f"  -> lavoura {lavoura_id}: processada com sucesso")


def processar_todas_lavouras():

    lavouras = buscar_todas_lavouras()
    print(f"[{date.today().isoformat()}] {len(lavouras)} lavoura(s) encontrada(s) para processar")

    for lavoura in lavouras:
        try:
            processar_lavoura(lavoura)
        except Exception as erro:
            print(f"  -> ERRO na lavoura {lavoura.get('id')}: {erro}")


if __name__ == "__main__":
    processar_todas_lavouras()