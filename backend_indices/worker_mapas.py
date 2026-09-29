import base64
import ctypes
import json
import logging
import multiprocessing
import os
from pathlib import Path
import signal
import ssl
import tempfile
import threading
import time

import pymysql
import requests
from dotenv import load_dotenv


load_dotenv()

log = logging.getLogger("fila_mapas")
TRAVA = "coffeevision:mapas:v1"
PARAR = threading.Event()


def conectar():
    contexto = ssl.create_default_context()

    if os.getenv("DB_SSL_CA_B64"):
        contexto.load_verify_locations(
            cadata=base64.b64decode(
                os.environ["DB_SSL_CA_B64"]
            ).decode()
        )

    elif os.getenv("DB_SSL_CA"):
        contexto.load_verify_locations(
            cafile=os.environ["DB_SSL_CA"]
        )

    return pymysql.connect(
        host=os.environ["DB_HOST"],
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        database=os.environ["DB_NAME"],
        charset="utf8mb4",
        ssl=contexto,
        autocommit=True,
        connect_timeout=10,
        read_timeout=15,
        write_timeout=15,
    )


def consultar(conexao, sql, parametros=()):
    with conexao.cursor() as cursor:
        cursor.execute(sql, parametros)
        return cursor.fetchall()


def conferir_trava(conexao):
    # Não reconectar silenciosamente:
    # a trava pertence à sessão original do MySQL.
    dono, sessao = consultar(
        conexao,
        "SELECT IS_USED_LOCK(%s), CONNECTION_ID()",
        (TRAVA,),
    )[0]

    if dono != sessao:
        raise RuntimeError(
            "Conexão perdeu a trava da fila."
        )


def processar(dados):
    from processar_lavouras import processar_lavoura

    falha_serie = False

    if dados.get("gerar_series") and dados.get("safras"):
        try:
            from serie_safras import gerar_series_safras

            gerar_series_safras(dados)

        except Exception:
            falha_serie = True
            log.exception(
                "Falha nas séries da lavoura %s",
                dados["id"],
            )

    resultado = processar_lavoura(dados)
    resultado["falha_serie"] = falha_serie

    status = resultado.get("status", "erro")

    if status == "concluido" and (
        falha_serie
        or resultado.get("erros")
        or resultado.get("avisos")
    ):
        status = "parcial"

    if status not in {
        "concluido",
        "parcial",
        "sem_dados",
        "erro",
    }:
        status = "erro"

    resultado["status"] = status

    return resultado


def executar_filho(dados, destino, pai):
    # No Linux/Render, encerra o filho se o supervisor morrer.
    if os.name == "posix" and Path("/proc").exists():
        ctypes.CDLL(None).prctl(1, signal.SIGTERM)

        if os.getppid() != pai:
            return

    logging.basicConfig(level=logging.INFO)

    try:
        resultado = processar(dados)

    except Exception:
        log.exception(
            "Falha na lavoura %s",
            dados["id"],
        )

        resultado = {
            "status": "erro",
            "mensagem": "Falha no processamento.",
        }

    Path(destino).write_text(
        json.dumps(
            resultado,
            ensure_ascii=False,
            default=str,
        ),
        encoding="utf-8",
    )


def executar_com_limite(conexao, dados):
    contexto = multiprocessing.get_context("spawn")

    limite = int(
        os.getenv("MAPAS_MAX_SEGUNDOS", "7200")
    )

    with tempfile.TemporaryDirectory() as pasta:
        destino = str(
            Path(pasta) / "resultado.json"
        )

        filho = contexto.Process(
            target=executar_filho,
            args=(dados, destino, os.getpid()),
        )

        filho.start()
        inicio = time.monotonic()

        try:
            while filho.is_alive():
                filho.join(timeout=2)
                conferir_trava(conexao)

                if PARAR.is_set():
                    raise InterruptedError(
                        "Worker encerrando."
                    )

                if time.monotonic() - inicio > limite:
                    return {
                        "status": "erro",
                        "mensagem": "Tempo máximo excedido.",
                    }

            conferir_trava(conexao)

            if (
                filho.exitcode != 0
                or not Path(destino).exists()
            ):
                raise RuntimeError(
                    "Processo de geração interrompido."
                )

            return json.loads(
                Path(destino).read_text(
                    encoding="utf-8"
                )
            )

        finally:
            if filho.is_alive():
                filho.terminate()
                filho.join(timeout=5)

            if filho.is_alive():
                filho.kill()
                filho.join()

            filho.close()


def enviar_notificacoes(conexao):
    pendentes = consultar(
        conexao,
        """
        SELECT id
        FROM fila_mapas
        WHERE status IN (
            'concluido',
            'parcial',
            'sem_dados',
            'erro'
        )
          AND notificar = 1
          AND email_enviado_em IS NULL
          AND (
              email_proxima_tentativa IS NULL
              OR email_proxima_tentativa <= UTC_TIMESTAMP()
          )
        ORDER BY id
        LIMIT 5
        """,
    )

    for (tarefa_id,) in pendentes:
        if PARAR.is_set():
            return

        try:
            resposta = requests.post(
                os.environ["BANCO_API_URL"].rstrip("/")
                + f"/interno/mapas/{tarefa_id}/notificar",
                headers={
                    "X-Mapas-Token": os.environ[
                        "MAPAS_INTERNAL_TOKEN"
                    ],
                },
                timeout=(5, 40),
            )

            resposta.raise_for_status()

        except requests.RequestException:
            log.warning(
                "E-mail da tarefa %s pendente.",
                tarefa_id,
            )

            consultar(
                conexao,
                """
                UPDATE fila_mapas
                SET email_proxima_tentativa = DATE_ADD(
                    UTC_TIMESTAMP(),
                    INTERVAL 5 MINUTE
                )
                WHERE id = %s
                  AND email_enviado_em IS NULL
                """,
                (tarefa_id,),
            )


def consumir(conexao):
    # Só o consumidor que possui a trava chega aqui.
    # Recupera tarefas interrompidas por reinício.
    consultar(
        conexao,
        """
        UPDATE fila_mapas
        SET
            status = 'erro',
            chave_ativa = NULL,
            finalizado_em = UTC_TIMESTAMP(),
            resultado = '{"mensagem":"Processamento interrompido três vezes."}'
        WHERE status = 'processando'
          AND tentativas >= 3
        """,
    )

    consultar(
        conexao,
        """
        UPDATE fila_mapas
        SET status = 'na_fila'
        WHERE status = 'processando'
        """,
    )

    while not PARAR.is_set():
        conferir_trava(conexao)
        enviar_notificacoes(conexao)

        tarefas = consultar(
            conexao,
            """
            SELECT id, dados
            FROM fila_mapas
            WHERE status = 'na_fila'
            ORDER BY id
            LIMIT 1
            """,
        )

        if not tarefas:
            PARAR.wait(5)
            continue

        tarefa_id, dados = tarefas[0]

        if isinstance(dados, (str, bytes)):
            dados = json.loads(dados)

        existe = consultar(
            conexao,
            """
            SELECT id
            FROM lavouras
            WHERE id = %s
              AND usuario_id = %s
            """,
            (dados["id"], dados["usuarioId"]),
        )

        consultar(
            conexao,
            """
            UPDATE fila_mapas
            SET
                status = 'processando',
                iniciado_em = UTC_TIMESTAMP(),
                tentativas = tentativas + 1
            WHERE id = %s
            """,
            (tarefa_id,),
        )

        log.info(
            "Iniciando tarefa=%s lavoura=%s",
            tarefa_id,
            dados["id"],
        )

        if existe:
            resultado = executar_com_limite(
                conexao,
                dados,
            )
        else:
            resultado = {"status": "cancelado"}

        conferir_trava(conexao)

        consultar(
            conexao,
            """
            UPDATE fila_mapas
            SET
                status = %s,
                resultado = %s,
                chave_ativa = NULL,
                finalizado_em = UTC_TIMESTAMP()
            WHERE id = %s
            """,
            (
                resultado["status"],
                json.dumps(resultado, default=str),
                tarefa_id,
            ),
        )

        log.info(
            "Finalizada tarefa=%s status=%s",
            tarefa_id,
            resultado["status"],
        )


def main():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    obrigatorias = (
        "DB_HOST",
        "DB_USER",
        "DB_PASSWORD",
        "DB_NAME",
        "BANCO_API_URL",
        "MAPAS_INTERNAL_TOKEN",
    )

    for nome in obrigatorias:
        if not os.getenv(nome):
            raise RuntimeError(
                f"Configure {nome} no worker."
            )

    signal.signal(
        signal.SIGTERM,
        lambda *_: PARAR.set(),
    )

    signal.signal(
        signal.SIGINT,
        lambda *_: PARAR.set(),
    )

    while not PARAR.is_set():
        conexao = None

        try:
            conexao = conectar()

            conseguiu = consultar(
                conexao,
                "SELECT GET_LOCK(%s, 0)",
                (TRAVA,),
            )[0][0]

            if conseguiu == 1:
                consumir(conexao)
            else:
                log.info(
                    "Outro worker está consumindo a fila."
                )

        except InterruptedError:
            pass

        except Exception:
            log.exception(
                "Worker interrompido; "
                "reconectando em 10 segundos."
            )

        finally:
            if conexao:
                conexao.close()

        PARAR.wait(10)


if __name__ == "__main__":
    main()