from flask import Blueprint, request, jsonify
from flask_mysqldb import MySQL
import bcrypt

desvincular_bp = Blueprint('desvincular', __name__)
mysql = None  # vai ser injetado pelo app.py

def init_mysql(mysql_instance):
    global mysql
    mysql = mysql_instance


@desvicular_bp.route("/desvincular", methods=[POST])
def desvincular():
    dados= request.get_json()
    produtor_id = dados.get("produtor")
    agronomo_id = dados.get("agronomo")

    if not produtor_id or not agronomo_id:
        return jsonify({"mensagem":"Produtores e agronomos são obrigatórios"}),400

    conexao = get_connection()
    cursor = conexao.curson()
    try:
        cursor.execute(
            "SELECT id FROM produtor WHERE id = %s AND agronomo_id = %s",
            (produtor_id, agronomo_id)
        )
        if cursor.fetchone() is None:
            return jsonify({"mensagem": "Vínculo não encontrado."}), 404

        cursor.execute(
            "UPDATE produtor SET agronomo_id = NULL WHERE id = %s",
            (produtor_id,)
        )
        conexao.commit()
        return jsonify({"mensagem": "Produtor desvinculado com sucesso."}), 200
    except Exception as erro:
        conexao.rollback()
        return jsonify({"mensagem": "Erro ao desvincular produtor."}), 500
    finally:
        cursor.close()
        conexao.close() 
