import hashlib
import json
import os
import secrets
from html import escape

from flask import Blueprint, current_app, jsonify, request
from email_utils import enviar_email, _moldura_html


fila_bp = Blueprint("fila_mapas", __name__)
mysql = None

FINAIS = {
    "concluido",
    "parcial",
    "sem_dados",
    "erro",
    "cancelado",
}


def init_mysql(instancia):
    global mysql
    mysql = instancia


def decodificar(valor):
    if isinstance(valor, (str, bytes)):
        return json.loads(valor)

    return valor


def mensagem_status(status):
    return {
        "na_fila": (
            "Geração na fila. Você pode sair desta tela."
        ),
        "processando": (
            "Estamos preparando as séries e os mapas da lavoura."
        ),
        "concluido": (
            "Processamento concluído. "
            "Consulte as imagens no histórico."
        ),
        "parcial": (
            "Processamento finalizado com pendências. "
            "Consulte os resultados disponíveis no histórico."
        ),
        "sem_dados": (
            "Não encontramos imagens válidas "
            "para o período consultado."
        ),
        "erro": (
            "Não foi possível concluir a geração. "
            "Sua lavoura continua cadastrada. "
            "Tente gerar as imagens novamente pelo histórico."
        ),
        "cancelado": (
            "Solicitação cancelada porque a lavoura foi removida."
        ),
    }.get(status, "Consulte o histórico da lavoura.")


def enfileirar(
    cursor,
    lavoura_id,
    usuario_id,
    gerar_series=True,
    notificar=True,
):
    # Usa a transação do cadastro/edição.
    # O commit será feito por quem chamou esta função.
    cursor.execute(
        """
        SELECT usuario_id, coordenadas, safras
        FROM lavouras
        WHERE id = %s
        FOR UPDATE
        """,
        (lavoura_id,),
    )

    linha = cursor.fetchone()

    if not linha or int(linha[0]) != int(usuario_id):
        raise ValueError(
            "Lavoura não encontrada para este usuário."
        )

    dados = {
        "id": int(lavoura_id),
        "usuarioId": int(usuario_id),
        "coordenadas": decodificar(linha[1]),
        "safras": decodificar(linha[2]) or [],
        "gerar_series": bool(gerar_series),
    }

    serializado = json.dumps(
        dados,
        sort_keys=True,
        separators=(",", ":"),
    )

    # Pedidos idênticos ainda ativos reutilizam a mesma tarefa.
    chave = hashlib.sha256(
        serializado.encode()
    ).hexdigest()

    cursor.execute(
        """
        INSERT INTO fila_mapas (
            lavoura_id,
            usuario_id,
            chave_ativa,
            dados,
            notificar
        )
        VALUES (%s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            notificar = GREATEST(
                notificar,
                VALUES(notificar)
            )
        """,
        (
            lavoura_id,
            usuario_id,
            chave,
            serializado,
            int(notificar),
        ),
    )

    cursor.execute(
        """
        SELECT id, status
        FROM fila_mapas
        WHERE chave_ativa = %s
        """,
        (chave,),
    )

    tarefa_id, status = cursor.fetchone()

    cursor.execute(
        "SELECT email FROM usuarios WHERE id = %s",
        (usuario_id,),
    )

    usuario = cursor.fetchone()

    email_previsto = bool(
        notificar
        and usuario
        and usuario[0]
        and current_app.config.get("BREVO_API_KEY")
        and current_app.config.get("BREVO_EMAIL_REMETENTE")
    )

    mensagem = mensagem_status(status)

    if email_previsto:
        mensagem += " Enviaremos um e-mail ao finalizar."

    return {
        "status": status,
        "tarefa_id": tarefa_id,
        "mensagem": mensagem,
        "email_previsto": email_previsto,
    }


@fila_bp.before_request
def proteger_rotas_internas():
    esperado = os.getenv("MAPAS_INTERNAL_TOKEN", "")
    recebido = request.headers.get("X-Mapas-Token", "")

    if (
        not esperado
        or not secrets.compare_digest(esperado, recebido)
    ):
        return jsonify(
            mensagem="Credencial interna inválida."
        ), 401


@fila_bp.post("/interno/mapas/enfileirar")
def incluir():
    dados = request.get_json(silent=True) or {}
    cursor = mysql.connection.cursor()

    try:
        resultado = enfileirar(
            cursor,
            int(dados["lavoura_id"]),
            int(dados["usuario_id"]),
        )

        mysql.connection.commit()

        return jsonify(resultado), 202

    except (KeyError, ValueError, TypeError):
        mysql.connection.rollback()

        return jsonify(
            mensagem=(
                "Informe uma lavoura e seu proprietário válidos."
            )
        ), 400

    except Exception:
        mysql.connection.rollback()
        current_app.logger.exception(
            "Falha ao incluir tarefa."
        )

        return jsonify(
            mensagem="Não foi possível registrar a geração."
        ), 503

    finally:
        cursor.close()


@fila_bp.post("/interno/mapas/enfileirar-todas")
def incluir_todas():
    cursor = mysql.connection.cursor()

    try:
        cursor.execute(
            """
            SELECT id, usuario_id, coordenadas, safras
            FROM lavouras
            ORDER BY id
            FOR UPDATE
            """
        )

        lavouras = cursor.fetchall()
        registros = []

        for lavoura_id, usuario_id, coordenadas, safras in lavouras:
            # Rotina diária: gera mapas atuais.
            # Não reconstrói todo o histórico nem envia e-mails em massa.
            dados = {
                "id": int(lavoura_id),
                "usuarioId": int(usuario_id),
                "coordenadas": decodificar(coordenadas),
                "safras": decodificar(safras) or [],
                "gerar_series": False,
            }

            serializado = json.dumps(
                dados,
                sort_keys=True,
                separators=(",", ":"),
            )

            chave = hashlib.sha256(
                serializado.encode()
            ).hexdigest()

            registros.append((
                lavoura_id,
                usuario_id,
                chave,
                serializado,
            ))

        if registros:
            cursor.executemany(
                """
                INSERT INTO fila_mapas (
                    lavoura_id,
                    usuario_id,
                    chave_ativa,
                    dados,
                    notificar
                )
                VALUES (%s, %s, %s, %s, 0)
                ON DUPLICATE KEY UPDATE
                    notificar = notificar
                """,
                registros,
            )

        mysql.connection.commit()

        return jsonify(
            status="na_fila",
            quantidade=len(lavouras),
        ), 202

    except Exception:
        mysql.connection.rollback()
        current_app.logger.exception(
            "Falha ao enfileirar lavouras."
        )

        return jsonify(
            mensagem="Não foi possível registrar o lote."
        ), 503

    finally:
        cursor.close()

@fila_bp.get("/interno/mapas/proxima")
def proxima_tarefa():
    cursor = mysql.connection.cursor()

    try:
        cursor.execute(
            """
            SELECT
                id,
                lavoura_id,
                usuario_id,
                dados
            FROM fila_mapas
            WHERE status = 'na_fila'
            ORDER BY id ASC
            LIMIT 1
            FOR UPDATE
            """
        )

        tarefa = cursor.fetchone()

        if not tarefa:
            mysql.connection.commit()
            return "", 204

        tarefa_id = tarefa[0]
        lavoura_id = tarefa[1]
        usuario_id = tarefa[2]
        dados = decodificar(tarefa[3])

        cursor.execute(
            """
            UPDATE fila_mapas
            SET
                status = 'processando',
                iniciado_em = UTC_TIMESTAMP()
            WHERE id = %s
              AND status = 'na_fila'
            """,
            (tarefa_id,)
        )

        mysql.connection.commit()

        return jsonify(
            tarefa_id=tarefa_id,
            lavoura_id=lavoura_id,
            usuario_id=usuario_id,
            dados=dados
        ), 200

    except Exception:
        mysql.connection.rollback()

        current_app.logger.exception(
            "Falha ao retirar tarefa da fila."
        )

        return jsonify(
            mensagem="Não foi possível obter a próxima tarefa."
        ), 503

    finally:
        cursor.close()


@fila_bp.post("/interno/mapas/<int:tarefa_id>/finalizar")
def finalizar_tarefa(tarefa_id):
    dados = request.get_json(silent=True) or {}

    status = dados.get(
        "status",
        "erro"
    )

    resultado = dados.get(
        "resultado"
    )

    erro = dados.get(
        "erro"
    )

    status_validos = {
        "concluido",
        "parcial",
        "sem_dados",
        "erro",
        "cancelado"
    }

    if status not in status_validos:
        return jsonify(
            mensagem="Status inválido."
        ), 400

    cursor = mysql.connection.cursor()

    try:
        cursor.execute(
            """
            UPDATE fila_mapas
            SET
                status = %s,
                finalizado_em = UTC_TIMESTAMP(),
                resultado = %s,
                erro = %s
            WHERE id = %s
            """,
            (
                status,
                json.dumps(resultado)
                if resultado is not None
                else None,
                erro,
                tarefa_id
            )
        )

        mysql.connection.commit()

        if cursor.rowcount == 0:
            return jsonify(
                mensagem="Tarefa não encontrada."
            ), 404

        return jsonify(
            status=status,
            tarefa_id=tarefa_id
        ), 200

    except Exception:
        mysql.connection.rollback()

        current_app.logger.exception(
            "Falha ao finalizar tarefa %s.",
            tarefa_id
        )

        return jsonify(
            mensagem="Não foi possível finalizar a tarefa."
        ), 503

    finally:
        cursor.close()

@fila_bp.post("/interno/mapas/<int:tarefa_id>/notificar")
def notificar(tarefa_id):
    cursor = mysql.connection.cursor()

    try:
        cursor.execute(
            """
            SELECT
                status,
                lavoura_id,
                usuario_id,
                notificar,
                email_enviado_em,
                (
                    email_proxima_tentativa IS NULL
                    OR email_proxima_tentativa <= UTC_TIMESTAMP()
                )
            FROM fila_mapas
            WHERE id = %s
            FOR UPDATE
            """,
            (tarefa_id,),
        )

        tarefa = cursor.fetchone()

        if not tarefa:
            mysql.connection.rollback()

            return jsonify(
                mensagem="Tarefa inexistente."
            ), 404

        (
            status,
            lavoura_id,
            usuario_id,
            habilitado,
            enviado,
            pode_tentar,
        ) = tarefa

        if (
            status not in FINAIS
            or not habilitado
            or enviado
            or not pode_tentar
        ):
            mysql.connection.commit()
            return jsonify(status="sem_envio"), 200

        # O destinatário sempre vem do banco.
        cursor.execute(
            """
            SELECT u.nome, u.email, l.nome_lavoura
            FROM usuarios u
            JOIN lavouras l ON l.usuario_id = u.id
            WHERE u.id = %s
              AND l.id = %s
            """,
            (usuario_id, lavoura_id),
        )

        pessoa = cursor.fetchone()

        if not pessoa or not pessoa[1]:
            cursor.execute(
                """
                UPDATE fila_mapas
                SET notificar = 0
                WHERE id = %s
                """,
                (tarefa_id,),
            )

            mysql.connection.commit()

            return jsonify(status="sem_destinatario"), 200

        nome, email, lavoura = pessoa

        texto = (
            f"Olá, {nome}!\n\n"
            f"Lavoura: {lavoura}.\n"
            f"{mensagem_status(status)}\n\n"
            f"Solicitação nº {tarefa_id}. "
            "Acesse o CoffeeVision para acompanhar."
        )

        assunto = {
            "concluido": "Seus mapas estão disponíveis",
            "parcial": "Processamento finalizado com pendências",
            "sem_dados": "Processamento finalizado sem imagens válidas",
            "erro": "Não foi possível concluir seus mapas",
        }.get(status, "Atualização dos mapas")

        html = _moldura_html(
            assunto,
            '<p style="white-space:pre-line;line-height:1.6">'
            + escape(texto)
            + "</p>",
        )

        try:
            enviar_email(
                email,
                "CoffeeVision — " + assunto,
                html,
                texto,
            )

        except Exception:
            current_app.logger.exception(
                "Falha na notificação da tarefa %s",
                tarefa_id,
            )

            # A falha do e-mail não altera o resultado dos mapas.
            cursor.execute(
                """
                UPDATE fila_mapas
                SET
                    email_tentativas = email_tentativas + 1,
                    email_proxima_tentativa = DATE_ADD(
                        UTC_TIMESTAMP(),
                        INTERVAL 5 MINUTE
                    )
                WHERE id = %s
                """,
                (tarefa_id,),
            )

            mysql.connection.commit()

            return jsonify(status="email_pendente"), 503

        cursor.execute(
            """
            UPDATE fila_mapas
            SET
                email_enviado_em = UTC_TIMESTAMP(),
                email_tentativas = email_tentativas + 1
            WHERE id = %s
            """,
            (tarefa_id,),
        )

        mysql.connection.commit()

        return jsonify(status="email_enviado"), 200

    except Exception:
        mysql.connection.rollback()
        current_app.logger.exception(
            "Falha ao confirmar notificação."
        )

        return jsonify(
            mensagem="Notificação não confirmada."
        ), 503

    finally:
        cursor.close()