import ee 
import google.auth
import numpy as np
import os 
from dotenv import load_dotenv
from graus_dia import get_graus_dia_data
from z_score import calcular_z_score
import requests
import xarray as xr
import s3fs



load_dotenv()


credentials_r2 = {
    "access_key_id": os.environ.get("ACCESS_KEY_ID"),
    "secret_access_key": os.environ.get("SECRET_ACCESS_KEY"),
    "client_kwargs": { "endpoint_url": os.environ.get("ENDPOINT_URL")}
}

from gee_auth import obter_credenciais

credentials, project_id = obter_credenciais()
ee.Initialize(credentials, project="projete2k26", opt_url="https://earthengine-highvolume.googleapis.com")

indices = ["NDVI", "NDRE", "NDWI"]

def add_NDVI_zscore(image):
    ndvi = image.normalizedDifference(["B8","B4"]).rename("NDVI")
    z_score,_,_ = calcular_z_score(ndvi, image.geometry())
    return image.addBands(z_score.rename("NDVI_zscore"))

def add_NDRE_zscore(image):
    ndre = image.normalizedDifference(["B8","B5"]).rename("NDRE")
    z_score,_,_ = calcular_z_score(ndre, image.geometry())
    return image.addBands(z_score.rename("NDRE_zscore"))

def add_NDWI_zscore(image):
    ndwi = image.normalizedDifference(["B3","B8"]).rename("NDWI")
    z_score,_,_ = calcular_z_score(ndwi, image.geometry())
    return image.addBands(z_score.rename("NDWI_zscore"))    
   

def make_time_series(geometria, data_inicio, data_fim, usuario_id: int, lavoura_id: int, ano : int, crs, crsTransform):
    inicio =ee.Date(data_inicio)
    fim = ee.Date(data_fim)
    lavoura = ee.Geometry.Polygon(geometria)
    imagens = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(lavoura)
        .filterDate(inicio, fim)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 30))
        .map(add_NDVI_zscore).map(add_NDRE_zscore).map(add_NDWI_zscore)
        .select(['NDVI_zscore', 'NDRE_zscore', 'NDWI_zscore'])
        .map(lambda image: image.clip(lavoura))
        .map(lambda image: image.reproject(crs= crs, crsTransform = crsTransform))
    )

    ds = xr.open_dataset(imagens, engine="ee", region=lavoura, crs='EPSG:4326', scale=10, max_pixels=1e8)
    renomear = {"time": "tempo", "lat": "y", "lon": "x", "Y": "y", "X": "x"}
    ds = ds.rename({k: v for k, v in renomear.items() if k in ds.dims})
    ds = ds.resample(time="1D").mean().transpose("tempo", "y", "x")
    lon, lat = lavoura.centroid().coordinates().getInfo()
    dias = [str(d)[:10] for d in ds.tempo.values]
    graus_dia_acum = np.cumsum([get_graus_dia_data(lat, lon, d, d) for d in dias])
    global indices
    for indice in indices:
        saida = (
            ds[indice + "_zscore"].rename("z_score").to_dataset()
            .assgn_coords({"graus_dia": ("tempo", graus_dia_acum), "safra": ano})
            .chunks({"tempo": 365, "y": -1, "x": -1})
        )
        url = f"{os.environ.get('ENDPOINT_URL')}{usuario_id}/{lavoura_id}/{indice}_zscore.zarr"
        saida.to_zarr(url, mode="w", consolidated=False, storage_options=credentials_r2)

    return {"mensagem": "Série temporal criada", "status": 200}
