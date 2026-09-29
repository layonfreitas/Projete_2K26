import logging
import os
import threading
import time

import requests

from processar_lavouras import processar_lavoura
from serie_safras import gerar_series_safras


log = logging.getLogger(__name__)


def obter_url_banco():
    return os.getenv(
        "BANCO_API_URL",
        ""
    ).rstrip("/")


def obter_token():
    return os.getenv(
        "MAPAS_INTERNAL_TOKEN",
        ""
    )


def pegar_proxima_tarefa():
    base = obter_url_banco()
    token = obter_token()

    if not base:
        raise RuntimeError(
            "BANCO_API_URL não configurada."
        )

    if not token:
        raise RuntimeError(
            "MAPAS_INTERNAL_TOKEN não configurado."
        )

    resposta = requests.get(
        base + "/interno/mapas/proxima",
        headers={
            "X-Mapas-Token": token
        },
        timeout=(5, 30)
    )

    if resposta.status_code == 204:
        return None

    resposta.raise_for_status()

    return resposta.json()


def finalizar_tarefa(
    tarefa_id,
    status,
    resultado=None,
    erro=None
):
    base = obter_url_banco()
    token = obter_token()

    dados = {
        "status": status,
        "resultado": resultado,
        "erro": erro
    }

    resposta = requests.post(
        base + f"/interno/mapas/{tarefa_id}/finalizar",
        json=dados,
        headers={
            "X-Mapas-Token": token
        },
        timeout=(5, 30)
    )

    resposta.raise_for_status()


def processar_tarefa(tarefa):
    tarefa_id = tarefa["tarefa_id"]
    dados = tarefa["dados"]

    lavoura_id = dados["id"]

    log.info(
        "[FILA] Iniciando lavoura %s. Tarefa %s.",
        lavoura_id,
        tarefa_id
    )

    try:
        if dados.get("safras"):
            try:
                resultado_series = gerar_series_safras(
                    dados
                )

                log.info(
                    "[FILA] Séries da lavoura %s concluídas: %s",
                    lavoura_id,
                    resultado_series
                )

            except Exception:
                log.exception(
                    "[FILA] Falha nas séries da lavoura %s.",
                    lavoura_id
                )

        resultado = processar_lavoura(
            dados
        )

        status = resultado.get(
            "status",
            "erro"
        )

        log.info(
            "[FILA] Lavoura %s terminou com status %s.",
            lavoura_id,
            status
        )

        finalizar_tarefa(
            tarefa_id=tarefa_id,
            status=status,
            resultado=resultado
        )

    except Exception as erro:
        log.exception(
            "[FILA] Erro processando lavoura %s.",
            lavoura_id
        )

        finalizar_tarefa(
            tarefa_id=tarefa_id,
            status="erro",
            erro=str(erro)
        )


def worker():
    log.info(
        "[FILA] Worker de mapas iniciado."
    )

    while True:
        try:
            tarefa = pegar_proxima_tarefa()

            if tarefa is None:
                time.sleep(1)
                continue

            processar_tarefa(tarefa)

        except Exception:
            log.exception(
                "[FILA] Erro no worker."
            )

            time.sleep(3)


def iniciar_worker():
    thread = threading.Thread(
        target=worker,
        name="fila-map-worker",
        daemon=True
    )

    thread.start()

    log.info(
        "[FILA] Thread do worker iniciada."
    )