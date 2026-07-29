import os
import httpx
from fastapi import FastAPI, HTTPException
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("OPENWEATHER_API_KEY")

app = FastAPI()

@app.get("/clima/")
async def get_clima(lat: float, lon: float):
    url = "https://api.openweathermap.org/data/2.5/weather"
    params = {
        "lat": lat,
        "lon": lon,
        "appid": API_KEY,
        "units": "metric",   # graus Celsius
        "lang": "pt_br"
    }
    async with httpx.AsyncClient() as client:
        response = await client.get(url, params=params)

    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail="Erro ao buscar clima")

    data = response.json()
    return {
        "temperatura": data["main"]["temp"],
        "sensacao_termica": data["main"]["feels_like"],
        "umidade": data["main"]["humidity"],
        "descricao": data["weather"][0]["description"],
        "vento": data["wind"]["speed"],
        "chuva_ultima_hora": data.get("rain", {}).get("1h", 0)
    }