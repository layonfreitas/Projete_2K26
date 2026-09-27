from flask import Blueprint, jsonify, request
import MySQLdb.cursors
from app import mysql

alertas_bp = Blueprint('alerta', __name__)

@alertas_bp.route('/alertas', methods=['POST'])
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

        # Ausente ou null no JSON vira NULL no banco.
        critico = alerta.get("critico")

        if critico is not None and (
            not isinstance(critico, (bool, int))
            or critico not in (0, 1)
        ):
            return jsonify({
                "mensagem": "critico deve ser true, false ou null."
            }), 400

        lista.append((
            alerta["usuario_id"],
            alerta["lavoura_id"],
            critico,
            indice,
            alerta.get("url"),
        ))

    cursor = None

    try:
        cursor = mysql.connection.cursor()

        cursor.executemany(
            """
            INSERT INTO alertas (
                usuario_id,
                lavoura_id,
                critico,
                indices,
                url
            )
            VALUES (%s, %s, %s, %s, %s)
            """,
            lista,
        )

        mysql.connection.commit()

        return jsonify({
            "mensagem": "Alertas salvos com sucesso.",
            "quantidade": len(lista),
        }), 201

    except Exception as erro:
        mysql.connection.rollback()

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

@alertas_bp.route("/alertas/<int:id>", methods = ["DELETE"])
def delete_alerta(id):
    try:
        cursor = mysql.connection.cursor()
        cursor.execute(
            """
            DELETE FROM alertas WHERE id = %s

            """,
            (id,)
        )

    except Exception as erro:
        return jsonify({"mensagem": "Erro ao deletar alerta", "erro": str(erro)}),500
    
