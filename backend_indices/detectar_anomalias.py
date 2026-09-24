import s3fs
import numpy as np
import xarray as xr
import ee
import matplotlib.pyplot as plt
from get_indices import save_image_indatabase, preparar_exportacao
from z_score import calcular_zscore_historico
from dotenv import load_dotenv

load_dotenv()

def salvar_png_anomalia(
    conteudo,
    indice,
    usuario_id,
    lavoura_id,
    geometria,
    data,
    classificacao,
    pasta_id=None
):
    _, meta = preparar_exportacao(
        geometria,
        usuario_id,
        lavoura_id
    )

    meta.update({
        "visualizacao": {
            "tipo": "z_score_indice_final",
            "indice": indice,
            "limiarAnormal": 2,
            "limiarCritico": 3.5,
            "regra": (
                "z <= -2 ou z <= -3.5"
                if indice.upper() == "NDWI"
                else "abs(z) >= 2 ou abs(z) >= 3.5"
            ),
        },
        "anomalia": {
            "critica": classificacao["tem_criticidade"],
        },
    })

    return save_image_indatabase(
        conteudo,
        f"z_score_{indice}_final_{data}",
        pasta_id,
        usuario_id,
        lavoura_id,
        data,
        None,
        meta
    )

def salvar_mapa_anomalia(
    indice,
    lavoura_id,
    usuario_id,
    geometria,
    z_scores_espacial,
    graus_dia,
    safra_atual,
    data,
    pasta_id=None
):
    z_score_final = calcular_zscore_historico(
        z_scores_espacial=z_scores_espacial,
        indice=indice,
        graus_dia=graus_dia,
        lavoura_id=lavoura_id,
        usuario_id=usuario_id,
        safra_atual=safra_atual
    )

    classificacao = classificar_anomalia(z_score_final, indice)

    if not classificacao["tem_anormalidade"]:
        return {
            "salvo": False,
            "temAnormalidade": False,
            "critico": False,
            "indice": "z_score_indice_final",
        }

    conteudo = renderizar_mapa_anomalia(
        z_score_final,
        indice,
        classificacao
    )

    registro = salvar_png_anomalia(
        conteudo=conteudo,
        indice=indice,
        usuario_id=usuario_id,
        lavoura_id=lavoura_id,
        geometria=geometria,
        data=data,
        classificacao=classificacao,
        pasta_id=pasta_id
    )

    return {
        "salvo": True,
        "temAnormalidade": True,
        "critico": classificacao["tem_criticidade"],
        "indice": "z_score_indice_final",
        "registro": registro,
    }

        
def renderizar_mapa_anomalia(z_score_final, indice, classificacao):
    import io
    import numpy as np
    

    z = z_score_final.to_numpy()
    mascara_anormal = classificacao["mascara_anormal"].to_numpy()
    mascara_critica = classificacao["mascara_critica"].to_numpy()

    rgba = np.zeros((*z.shape, 4), dtype=np.uint8)

    if indice.upper() == "NDWI":
        moderado = mascara_anormal & ~mascara_critica
        critico = mascara_critica
    else:
        moderado = mascara_anormal & ~mascara_critica
        critico = mascara_critica

    # Amarelo para anomalia moderada
    rgba[moderado] = [255, 193, 7, 255]
    # Vermelho para anomalia crítica
    rgba[critico] = [220, 53, 69, 255]
    # NaN fica transparente
    rgba[~np.isfinite(z)] = [0, 0, 0, 0]

    figura, eixo = plt.subplots(figsize=(10, 10), dpi=150)
    eixo.imshow(rgba, interpolation="nearest")
    eixo.axis("off")
    figura.subplots_adjust(left=0, right=1, bottom=0, top=1)

    buffer = io.BytesIO()
    figura.savefig(
        buffer,
        format="png",
        transparent=True,
        bbox_inches="tight",
        pad_inches=0
    )
    plt.close(figura)

    return buffer.getvalue()
    




        
        

  