import s3fs
import numpy as np
import xarray as xr
import ee

def calcular_zscore_historico(z_scores_espacial,indice, graus_dia, lavoura_id, usuario_id, safra_atual):
    
    indices = [ "NDVI", "NDRE", "NDWI"]

    fs = s3fs.S3FileSystem(
        key=os.environ.get("ACCESS_KEY_ID"),
        secret=os.environ.get("SECRET_ACCESS_KEY")
    )



    
    
    
    url = f"{os.environ.get("ENDPOINT_URL")}/{usuario_id}/{lavoura_id}/{indice}_zscore.zarr"

    with open (url, 'rb') as f:
        ds = xr.open_zarr(f, consolidated=False)
        filtros = (ds["safra"] != safra_atual) & (ds["graus_dia"] >= graus_dia - 50) & (ds["graus_dia"] <= graus_dia + 50)
        zscore_historico = ds["z_score"].where(filtros, drop=True)
        mediana = zscore_historico.median(dim="tempo", skipna=True)
        diferenca = (z_scores_espacial - mediana).abs()
        mad = diferenca.median(dim = "tempo", skipna = True)
        z_score_final = (0.6745*diferenca/mad)
        return z_score_final

def salvar_mapa_anomalias(indice, lavoura_id, usuario_id, geometria, z_scores_espacial, graus_dia, safra_atual):
    

    z_score_final = calcular_zscore_historico(z_scores_espacial, indice, graus_dia, lavoura_id, usuario_id, safra_atual)
    




        

    




        
        

  