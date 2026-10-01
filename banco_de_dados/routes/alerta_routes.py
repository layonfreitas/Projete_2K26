import os
import secrets
import MySQLdb.cursors

from flask import Blueprint, jsonify, request
from flask import current_app
from email_alertas import notificar_alertas

alertas_bp = Blueprint('alerta', __name__)

mysql = None

def init_mysql(mysql_instance):
    global mysql
    mysql = mysql_instance

@alertas_bp.route('/alertas', methods=['POST'])
def insert_alerta():
        
    token_configurado = os.getenv("ALERTAS_TOKEN", "")
    token_recebido = request.headers.get("X-Alertas-Token", "")

    if not token_configurado:
        current_app.logger.error("ALERTAS_TOKEN não configurado.")
        return jsonify({
            "mensagem": "Serviço de alertas não configurado."
        }), 503

    if not secrets.compare_digest(
        token_recebido,
        token_configurado,
    ):
        return jsonify({
            "mensagem": "Não autorizado."
        }), 401
    
    dados = request.get_json(silent=True)

    if not isinstance(dados, list) or not dados:
        return jsonify({
            "mensagem": "Envie uma lista não vazia de alertas."
        }), 400

    lista = []

    for alerta in dados:
        if not isinstance(alerta, dict):
            return jsonify({
                "mensagem": "Cada alerta deve ser um objeto."
            }), 400

        # O processamento envia "indice".
        # A coluna do banco se chama "indices".
        indice = alerta.get("indice", alerta.get("indices"))

        if indice not in ("NDVI", "NDWI", "NDRE", "CLMI"):
            return jsonify({
                "mensagem": "Índice inválido."
            }), 400

        if (
            not alerta.get("usuario_id")
            or not alerta.get("lavoura_id")
        ):
            return jsonify({
                "mensagem": "Informe usuario_id e lavoura_id."
            }), 400

        critico = alerta.get("critico")

        # A coluna "critico" no banco é BOOLEAN NOT NULL: não aceita nulo.
        if not isinstance(critico, (bool, int)) or critico not in (0, 1):
            return jsonify({
                "mensagem": "critico deve ser true ou false."
            }), 400

        # Usa os mesmos valores já validados/normalizados acima (a versão
        # antiga montava essa lista de novo lendo os campos "crus", o que
        # fazia a validação de cima não valer de nada e quebrava com
        # KeyError sempre que faltava "critico" ou vinha "indices").
        lista.append((
            alerta["usuario_id"],
            alerta["lavoura_id"],
            critico,
            indice,
            alerta.get("data_imagem"),
            alerta.get("contorno"),
        ))

    cursor = None

    try:
        query = """
            INSERT INTO alertas (usuario_id, lavoura_id, critico, indices, data_imagem, contorno)
            VALUES (%s, %s, %s, %s, %s, %s)
        """
        cursor = mysql.connection.cursor()

        # Salva os alertas.
        cursor.executemany(query, lista)

        # Atualiza o estado das lavouras com alerta crítico.
        for alerta in lista:
            (
                usuario_id,
                lavoura_id,
                critico,
                indice,
                data_imagem,
                contorno,
            ) = alerta

            if critico not in (True, 1):
                continue

            cursor.execute(
                """
                UPDATE lavouras
                SET
                    status = 'critico',
                    status_data_imagem = COALESCE(
                        %s,
                        status_data_imagem
                    )
                WHERE id = %s
                AND usuario_id = %s
                AND (
                    status_data_imagem IS NULL
                    OR %s >= status_data_imagem
                )
                """,
                (
                    data_imagem,
                    lavoura_id,
                    usuario_id,
                    data_imagem,
                ),
            )

            current_app.logger.info(
                "Alerta crítico da lavoura %s: "
                "%s registro(s) atualizado(s).",
                lavoura_id,
                cursor.rowcount,
            )

        # Grava os alertas e o estado na mesma transação.
        mysql.connection.commit()    

        # Os alertas já estão salvos.
        # Uma falha no e-mail não desfaz esses registros.
        cursor.close()
        cursor = None

        try:
            emails = notificar_alertas(
                mysql.connection,
                lista,
            )
        except Exception:
            mysql.connection.rollback()

            current_app.logger.exception(
                "Alertas salvos, mas houve falha na notificação."
            )

            emails = {
                "enviados": 0,
                "repetidos": 0,
                "falhas": 1,
            }

        current_app.logger.info(
            "Resultado dos e-mails de alerta: %s",
            emails,
        )

        return jsonify({
            "mensagem": "Alerta(s) inserido(s) no banco de dados.",
            "emails": emails,
        }), 200

    except Exception as erro:
        mysql.connection.rollback()

        current_app.logger.exception(
            "Falha ao salvar os alertas e atualizar a lavoura."
        )

        return jsonify({
            "mensagem": "Não foi possível salvar os alertas.",
            "erro": str(erro),
        }), 500

    finally:
        if cursor is not None:
            cursor.close()

@alertas_bp.route('/alertas/<int:lavoura_id>', methods=['GET'])
def listar_alertas(lavoura_id):
    cursor = None

    try:
        cursor = mysql.connection.cursor(
            MySQLdb.cursors.DictCursor
        )

        cursor.execute(
            """
            SELECT
                id,
                usuario_id,
                lavoura_id,
                critico,
                indices AS indice,
                DATE_FORMAT(data_imagem, '%%Y-%%m-%%d')
                    AS data_imagem,
                contorno
            FROM alertas
            WHERE lavoura_id = %s
            ORDER BY data_imagem DESC, id DESC
            """,
            (lavoura_id,),
        )

        resultados = list(cursor.fetchall())

        for alerta in resultados:
            alerta["critico"] = bool(alerta["critico"])

        return jsonify(resultados), 200

    except Exception as erro:
        return jsonify({
            "mensagem": "Erro ao buscar alertas",
            "erro": str(erro),
        }), 500

    finally:
        if cursor is not None:
            cursor.close()

@alertas_bp.route("/alertas/<int:id>", methods=["DELETE"])
def delete_alerta(id):
    cursor = None
    try:
        cursor = mysql.connection.cursor()
        cursor.execute(
            "DELETE FROM alertas WHERE id = %s",
            (id,),
        )
        # Faltava o commit: sem ele, a exclusão nunca era gravada de fato.
        mysql.connection.commit()

        # Faltava também o return: toda chamada bem-sucedida derrubava
        # a API com "The view function did not return a valid response".
        return jsonify({"mensagem": "Alerta removido."}), 200

    except Exception as erro:
        return jsonify({"mensagem": "Erro ao deletar alerta", "erro": str(erro)}), 500

    finally:
        if cursor is not None:
            cursor.close()
@alertas_bp.route("/lavouras/<int:lavoura_id>/status-analise", methods=["POST"])
def atualizar_status_analise(lavoura_id):
    import json
    from datetime import date

    token = os.getenv("ALERTAS_TOKEN", "")
    recebido = request.headers.get("X-Alertas-Token", "")
    if not token:
        return jsonify({"mensagem": "ALERTAS_TOKEN não configurado."}), 503
    if not secrets.compare_digest(recebido, token):
        return jsonify({"mensagem": "Não autorizado."}), 401

    dados = request.get_json(silent=True)
    if not isinstance(dados, dict):
        return jsonify({"mensagem": "Envie um objeto JSON."}), 400

    estado = dados.get("status")
    coordenadas = dados.get("coordenadas")
    try:
        data_imagem = date.fromisoformat(dados.get("data_imagem", ""))
    except (TypeError, ValueError):
        return jsonify({"mensagem": "Data da imagem inválida."}), 400

    if (
        estado not in ("ok", "critico")
        or (
            estado == "ok"
            and dados.get("analise_completa") is not True
        )
        or (
            estado == "critico"
            and dados.get("critico_detectado") is not True
        )
        or not isinstance(coordenadas, list)
        or len(coordenadas) < 3
        or data_imagem > date.today()
    ):
        return jsonify({
            "mensagem": "Análise incompleta ou dados inválidos."
        }), 400
        return jsonify({"mensagem": "Análise incompleta ou dados inválidos."}), 400

    cursor = None
    try:
        cursor = mysql.connection.cursor()
        cursor.execute("""
            SELECT status_data_imagem, coordenadas
            FROM lavouras WHERE id = %s FOR UPDATE
        """, (lavoura_id,))
        linha = cursor.fetchone()

        if not linha:
            mysql.connection.rollback()
            return jsonify({"mensagem": "Lavoura não encontrada."}), 404

        # Não aplica o resultado de um contorno que já foi editado.
        atuais = json.loads(linha[1]) if isinstance(linha[1], (str, bytes)) else linha[1]
        if atuais != coordenadas:
            mysql.connection.rollback()
            return jsonify({
                "atualizado": False,
                "mensagem": "Contorno alterado; resultado ignorado."
            }), 200

        # Uma imagem antiga não substitui um estado mais recente.
        if linha[0] and data_imagem < linha[0]:
            mysql.connection.rollback()
            return jsonify({
                "atualizado": False,
                "mensagem": "Análise antiga; resultado ignorado."
            }), 200

        cursor.execute("""
            UPDATE lavouras
            SET status = %s, status_data_imagem = %s
            WHERE id = %s
        """, (estado, data_imagem, lavoura_id))
        mysql.connection.commit()
        return jsonify({"atualizado": True, "status": estado}), 200
    except Exception:
        mysql.connection.rollback()
        current_app.logger.exception("Falha ao atualizar estado da lavoura.")
        return jsonify({"mensagem": "Erro ao atualizar estado."}), 500
    finally:
        if cursor is not None:
            cursor.close()

