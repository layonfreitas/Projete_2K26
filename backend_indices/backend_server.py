import os

import ee
import google.auth
from get_indices import get_indices_image, save_indice_map
from pydantic import BaseModel
from fastapi import FastAPI, status
from datetime import date
from z_score import salvar_mapa_z_score
from serie_temporal import Imagem_para_zona_de_manejo, create_zonas_de_manejo
from dotenv import load_dotenv

load_dotenv()

credentials, project_id = google.auth.default()
ee.Initialize(credentials, project="projete2k26")

class Day_req(BaseModel):
    coordenadas: list[list[float]]
    usuario_id: int
    lavoura_id: int
    
class Zona_de_manejo_req(BaseModel):
    coordenadas: list[list[float]]
    data_inicio: date
    data_fim: date
    usuario_id: int
    lavoura_id: int
    tamanho_min: float


indices = ["NDVI", "NDRE", "NDWI"]

app = FastAPI()


    





@app.post("/day_maps/", status_code=status.HTTP_201_CREATED)
async def create_day_maps(day_req: Day_req):
    print("Iniciando processamento de imagens para a geometria")
    geometria = ee.Geometry.Polygon(day_req.coordenadas)
    usuario_id = day_req.usuario_id
    lavoura_id = day_req.lavoura_id
    imagemHoje = get_indices_image(geometria,date.today().isoformat(), 5, 30)
     # será necessário implementar a lógica para verificar se já foram obtido os dados da data da imagem
    if len(imagemHoje.bandNames().getInfo())==0:
        return {
            "status": "sem_imagem",
            "mensagem": "nehuma imagem válida foi encontrada."
        }
    for indice in indices:
        print(f"Salvando mapa do índice {indice} para a geometria")
        save_indice_map(imagemHoje, indice, geometria, usuario_id, lavoura_id)
        salvar_mapa_z_score(imagemHoje, indice, usuario_id, lavoura_id, geometria)

    return {
        "status": "sucesso",
        "mensagem": "Uma nova imagem foi processada."
    }
   
@app.post("/get_zona_de_manejo/", status_code=status.HTTP_201_CREATED)
async def zonas_de_manejo(zona_de_manejo_req: Zona_de_manejo_req):
    geometria = ee.Geometry.Polygon(zona_de_manejo_req.coordenadas)
    usuario_id = zona_de_manejo_req.usuario_id
    lavoura_id = zona_de_manejo_req.lavoura_id
    array = Imagem_para_zona_de_manejo(geometria, zona_de_manejo_req.data_inicio.isoformat(), zona_de_manejo_req.data_fim.isoformat())
    arquivo = create_zonas_de_manejo(array = array,usuario_id= usuario_id, lavoura_id= lavoura_id, tamanho_min= zona_de_manejo_req.tamanho_min )
    return{
        "status": "sucesso",
        "mensagem": "Zonas de manejo criadas.",
        "arquivo": arquivo
    }