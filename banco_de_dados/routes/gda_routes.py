from flask import Blueprint, request, jsonify

gda_bp = Blueprint('gda', __name__)

mysql = None  

def init_mysql(mysql_instance):
    global mysql
    mysql = mysql_instance

@gda_bp.route('/gda', methods=['POST'])
def salvar_gda():
    dados = request.get_json()
    lavoura_id = dados.get('lavouraId')
    usuario_id = dados.get('usuarioId')
    gda = dados.get('gda')  

    if not lavoura_id or not usuario_id or gda is None:
        return jsonify({
            "mensagem": "lavouraId, usuarioId e gda são obrigatórios"
        }), 400

    try:
        cursor = mysql.connection.cursor()
        cursor.execute(

        )