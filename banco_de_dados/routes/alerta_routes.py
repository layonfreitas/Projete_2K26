from flask import Blueprint, jsonify, request
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



@alertas_bp.route('/alertas', methods=['GET'])
def listar_avisos():
    usuario_id = request.args.get('usuario_id')  # ou pegue da sessão/token, conforme o login de vocês
    apenas_nao_lidos = request.args.get('lido') == 'false'

    cursor = mysql.connection.cursor()
    query = "SELECT * FROM avisos WHERE usuario_id = %s"
    params = [usuario_id]

    if apenas_nao_lidos:
        query += " AND lido = FALSE"

    query += " ORDER BY criado_em DESC"
    cursor.execute(query, params)
    colunas = [desc[0] for desc in cursor.description]
    avisos = [dict(zip(colunas, linha)) for linha in cursor.fetchall()]
    cursor.close()

    return jsonify(avisos)


