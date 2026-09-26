from flask import Blueprint, jsonify, request
import MySQLdb.cursors
from app import mysql

alertas_bp = Blueprint('alerta', __name__)

@alertas_bp.route('/alertas', methods=['POST'])
def insert_alerta():
    dados = request.get_json()

    lista  = [(linha["usuario_id"], linha["lavoura_id"], linha["critico"], linha["indice"]) for linha in dados]
    try:
        query = "INSERT INTO alertas (usuario_id, lavoura_id, critico, indice) VALUES(%s,%s,%s,%s)"
        cursor = mysql.connection.cursor()
        cursor.executemany(query, lista)
       
        return jsonify({"mensagem": "Alerta(s) inserido(s) no banco de dados."}), 200

    except Exception as erro:
        return jsonify({"mensagem":"Não foi possivel inserir o(s) alerta(s) no banco de dados", "erro": str(erro)}), 500



@alertas_bp.route('/alertas/<int: lavoura_id>', methods=['GET'])
def listar_alertas(lavoura_id):

    try:

        cursor = mysql.connection.cursor(MySQLdb.cursors.DictCursor)

        cursor.execute(
            """
           SELCT * FROM alertas WHERE lavoura_id = %s
            """,
            (lavoura_id)
            
        )

        resultados = cursor.fetchall()

        cursor.close()

        
        return jsonify(resultados), 200

    except Exception as erro:

        return jsonify({
            "mensagem": "Erro ao buscar alertas",
            "erro": str(erro)
        }), 500

@alertas_bp.route("/alertas/<int: id>", methods = ["DELETE"])
def delete_alerta(id):
    try:
        cursor = mysql.connection.cursor()
        cursor.execute(
            """
            DELETE FROM alertas WHERE id = %s

            """
            (id)
        )

    except Exception as erro:
        return jsonify({"mensagem": "Erro ao deletar alerta", "erro": str(erro)}),500
    
