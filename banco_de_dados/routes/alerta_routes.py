from flask import Blueprint, jsonify, request
import MySQLdb.cursors
from app import mysql

alertas_bp = Blueprint('alerta', __name__)

@alertas_bp.route('/alertas', methods=['POST'])
def insert_alerta():
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
        cursor.executemany(query, lista)
        mysql.connection.commit()

        return jsonify({"mensagem": "Alerta(s) inserido(s) no banco de dados."}), 200

    except Exception as erro:
        return jsonify({
            "mensagem": "Não foi possível salvar os alertas.",
            "erro": str(erro),
        }), 500

    finally:
        if cursor is not None:
            cursor.close()

@alertas_bp.route('/alertas/<int:lavoura_id>', methods=['GET'])
def listar_alertas(lavoura_id):

    try:

        cursor = mysql.connection.cursor(MySQLdb.cursors.DictCursor)

        cursor.execute(
            """
           SELECT * FROM alertas WHERE lavoura_id = %s
            """,
            (lavoura_id,)
            
        )

        resultados = cursor.fetchall()

        cursor.close()

        
        return jsonify(resultados), 200

    except Exception as erro:

        return jsonify({
            "mensagem": "Erro ao buscar alertas",
            "erro": str(erro)
        }), 500

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