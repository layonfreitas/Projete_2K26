import os
import time
import logging
import requests

from dotenv import load_dotenv

from processar_lavouras import processar_lavoura
from serie_safras import gerar_series_safras


load_dotenv()


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)


log = logging.getLogger("fila-worker")


BANCO_API_URL = os.getenv(
    "BANCO_API_URL",
    "",
).rstrip("/")


MAPAS_INTERNAL_TOKEN = os.getenv(
    "MAPAS_INTERNAL_TOKEN",
    "")


INTERVALO_FILA = int(
    os.getenv(
        "FILA_INTERVALO",
        "2",
    )
)


def headers():

    return {
        "X-Mapas-Token": MAPAS_INTERNAL_TOKEN
    }


def pegar_proxima_tarefa():

    resposta = requests.get(
        BANCO_API_URL
        + "/interno/mapas/proxima",

        headers=headers(),

        timeout=60,
    )

    if resposta.status_code == 204:
        return None

    resposta.raise_for_status()

    return resposta.json()


def finalizar_tarefa(
    tarefa_id,
    status,
    resultado=None,
    erro=None,
):

    dados = {
        "status": status,
        "resultado": resultado,
        "erro": erro,
    }

    resposta = requests.post(
        BANCO_API_URL
        + f"/interno/mapas/{tarefa_id}/finalizar",

        json=dados,

        headers=headers(),

        timeout=60,
    )

    resposta.raise_for_status()


def processar_tarefa(tarefa):

    tarefa_id = tarefa["tarefa_id"]

    dados = tarefa["dados"]

    lavoura_id = dados["id"]

    log.info(
        "========================================"
    )

    log.info(
        "[FILA] Iniciando lavoura %s",
        lavoura_id,
    )

    log.info(
        "[FILA] Tarefa %s",
        tarefa_id,
    )

    try:

        if dados.get(
            "gerar_series",
            False,
        ):

            try:

                log.info(
                    "[FILA] Gerando séries da lavoura %s",
                    lavoura_id,
                )

                resultado_series = (
                    gerar_series_safras(
                        dados
                    )
                )

                log.info(
                    "[FILA] Séries concluídas: %s",
                    resultado_series,
                )

            except Exception:

                log.exception(
                    "[FILA] Erro nas séries da lavoura %s",
                    lavoura_id,
                )

        log.info(
            "[FILA] Gerando mapas da lavoura %s",
            lavoura_id,
        )

        resultado = processar_lavoura(
            dados
        )

        status = resultado.get(
            "status",
            "erro",
        )

        log.info(
            "[FILA] Lavoura %s terminou: %s",
            lavoura_id,
            status,
        )

        finalizar_tarefa(
            tarefa_id=tarefa_id,
            status=status,
            resultado=resultado,
        )

        log.info(
            "[FILA] Tarefa %s finalizada.",
            tarefa_id,
        )

    except Exception as erro:

        log.exception(
            "[FILA] Erro na lavoura %s",
            lavoura_id,
        )

        try:

            finalizar_tarefa(
                tarefa_id=tarefa_id,
                status="erro",
                erro=str(erro),
            )

        except Exception:

            log.exception(
                "[FILA] Não foi possível registrar "
                "o erro da tarefa %s",
                tarefa_id,
            )


def validar_configuracao():

    if not BANCO_API_URL:

        raise RuntimeError(
            "BANCO_API_URL não configurada."
        )

    if not MAPAS_INTERNAL_TOKEN:

        raise RuntimeError(
            "MAPAS_INTERNAL_TOKEN não configurado."
        )


def executar_worker():

    validar_configuracao()

    log.info(
        "[FILA] Worker iniciado."
    )

    log.info(
        "[FILA] Banco: %s",
        BANCO_API_URL,
    )

    while True:

        try:

            tarefa = pegar_proxima_tarefa()

            if tarefa is None:

                time.sleep(
                    INTERVALO_FILA
                )

                continue

            processar_tarefa(
                tarefa
            )

            # Assim que termina,
            # volta imediatamente para a fila.
            continue

        except requests.RequestException:

            log.exception(
                "[FILA] Erro de comunicação "
                "com o banco."
            )

            time.sleep(5)

        except Exception:

            log.exception(
                "[FILA] Erro inesperado no worker."
            )

            time.sleep(5)


if __name__ == "__main__":

    executar_worker()