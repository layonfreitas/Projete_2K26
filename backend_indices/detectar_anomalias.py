import s3fs
import numpy as np
import xarray as xr
import ee
import matplotlib.pyplot as plt

from get_indices import save_image_indatabase, preparar_exportacao
from z_score import calcular_zscore_historico
from dotenv import load_dotenv

load_dotenv()


def classificar_anomalia(z_score, indice):

    z = z_score.to_numpy()

    if indice.upper() == "NDWI":
        mascara_aumento_anormalidade = np.zeros(
            z.shape,
            dtype=bool
        )

        mascara_aumento_criticidade = np.zeros(
            z.shape,
            dtype=bool
        )

        mascara_diminuicao_anormalidade = z <= -2

        mascara_diminuicao_criticidade = z <= -3.5

    else:
        mascara_aumento_anormalidade = z >= 2

        mascara_aumento_criticidade = z >= 3.5

        mascara_diminuicao_anormalidade = z <= -2

        mascara_diminuicao_criticidade = z <= -3.5

    mascara_aumento_anormalidade = xr.DataArray(
        mascara_aumento_anormalidade,
        coords=z_score.coords,
        dims=z_score.dims
    )

    mascara_aumento_criticidade = xr.DataArray(
        mascara_aumento_criticidade,
        coords=z_score.coords,
        dims=z_score.dims
    )

    mascara_diminuicao_anormalidade = xr.DataArray(
        mascara_diminuicao_anormalidade,
        coords=z_score.coords,
        dims=z_score.dims
    )

    mascara_diminuicao_criticidade = xr.DataArray(
        mascara_diminuicao_criticidade,
        coords=z_score.coords,
        dims=z_score.dims
    )

    tem_aumento = bool(
        mascara_aumento_anormalidade.any()
    )

    tem_diminuicao = bool(
        mascara_diminuicao_anormalidade.any()
    )

    tem_anormalidade = (
        tem_aumento or
        tem_diminuicao
    )

    tem_criticidade = bool(
        mascara_aumento_criticidade.any()
        or
        mascara_diminuicao_criticidade.any()
    )

    return {
        "mascara_aumento_anormalidade":
            mascara_aumento_anormalidade,

        "mascara_aumento_criticidade":
            mascara_aumento_criticidade,

        "mascara_diminuicao_anormalidade":
            mascara_diminuicao_anormalidade,

        "mascara_diminuicao_criticidade":
            mascara_diminuicao_criticidade,

        "tem_aumento":
            tem_aumento,

        "tem_diminuicao":
            tem_diminuicao,

        "tem_anormalidade":
            tem_anormalidade,

        "tem_criticidade":
            tem_criticidade
    }


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
            "tipo": f"z_score_{indice}_final",
            "indice": indice,
            "limiarAnormal": 2,
            "limiarCritico": 3.5,
            "regra": (
                "z <= -2; crítico se z <= -3.5"
                if indice.upper() == "NDWI"
                else (
                    "z >= 2 ou z <= -2; "
                    "crítico se z >= 3.5 ou z <= -3.5"
                )
            )
        },

        "anomalia": {
            "anormal": classificacao["tem_anormalidade"],
            "critica": classificacao["tem_criticidade"]
        }
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

    classificacao = classificar_anomalia(
        z_score_final,
        indice
    )

    if not classificacao["tem_anormalidade"]:
        return {
            "salvo": False,
            "temAnormalidade": False,
            "temCriticidade": False,
            "indice": f"z_score_{indice}_final"
        }

    conteudo = renderizar_mapa_anomalia(
        z_score_final,
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
        "temCriticidade": classificacao["tem_criticidade"],
        "indice": f"z_score_{indice}_final",
        "registro": registro
    }


def renderizar_mapa_anomalia(
    z_score_final,
    classificacao
):

    import io

    z = z_score_final.to_numpy()

    mascara_aumento_anormalidade = (
        classificacao[
            "mascara_aumento_anormalidade"
        ].to_numpy()
    )

    mascara_aumento_criticidade = (
        classificacao[
            "mascara_aumento_criticidade"
        ].to_numpy()
    )

    mascara_diminuicao_anormalidade = (
        classificacao[
            "mascara_diminuicao_anormalidade"
        ].to_numpy()
    )

    mascara_diminuicao_criticidade = (
        classificacao[
            "mascara_diminuicao_criticidade"
        ].to_numpy()
    )

    aumento_atencao = (
        mascara_aumento_anormalidade
        & ~mascara_aumento_criticidade
    )

    diminuicao_atencao = (
        mascara_diminuicao_anormalidade
        & ~mascara_diminuicao_criticidade
    )

    rgba = np.zeros(
        (*z.shape, 4),
        dtype=np.uint8
    )

    # Aumento em atenção
    rgba[aumento_atencao] = [
        255, 193, 7, 255
    ]

    # Aumento crítico
    rgba[mascara_aumento_criticidade] = [
        220, 53, 69, 255
    ]

    # Diminuição em atenção
    rgba[diminuicao_atencao] = [
        255, 152, 0, 255
    ]

    # Diminuição crítica
    rgba[mascara_diminuicao_criticidade] = [
        128, 0, 0, 255
    ]

    # NaN fica transparente
    rgba[~np.isfinite(z)] = [
        0, 0, 0, 0
    ]

    figura, eixo = plt.subplots(
        figsize=(10, 10),
        dpi=150
    )

    eixo.imshow(
        rgba,
        interpolation="nearest"
    )

    eixo.axis("off")

    figura.subplots_adjust(
        left=0,
        right=1,
        bottom=0,
        top=1
    )

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