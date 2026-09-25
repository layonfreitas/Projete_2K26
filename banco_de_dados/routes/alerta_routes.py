from flask import Blueprint, jsonify, request
from flask_mail import Message
from app import mysql, mail


alertas_bp = Blueprint('alerta', __name__)

@alertas_bp.route('/alertas', methods=['POST'])
def mandar_alerta():
    dados = request.get_json()
    usuario_id = dados.get("usuario")
    lavoura_id = dados.get("lavoura")
    indices = dados.get("indice")

    if not usuario_id or not lavoura_id or not indices:
        return jsonify({"mensagem":"todos os campos são obrigatórios"}), 400



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


@alertas_bp.route('/alertas/<int:aviso_id>/marcar-lido', methods=['PUT'])
def marcar_lido(aviso_id):
    cursor = mysql.connection.cursor()
    cursor.execute("UPDATE avisos SET lido = TRUE WHERE id = %s", (aviso_id,))
    mysql.connection.commit()
    cursor.close()
    return jsonify({'sucesso': True})