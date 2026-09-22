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
            "INSERT INTO gda (usuario_id, lavoura_id, gda) VALUES (%s, %s, %s)",
            (usuario_id, lavoura_id, gda)
        )
        mysql.connection.commit()
        cursor.close()
        return jsonify({"mensagem": "GDA salvo com sucesso"}), 201
    except Exception as erro:
        return jsonify({"mensagem": "Erro ao salvar GDA", "erro": str(erro)}), 500


@gda_bp.route('/gda/<int:lavoura_id>', methods=['GET'])
def listar_gda(lavoura_id):
    try:
        cursor = mysql.connection.cursor()
        cursor.execute(
            "SELECT id, usuario_id, lavoura_id, gda FROM gda WHERE lavoura_id = %s",
            (lavoura_id,)
        )
        resultados = cursor.fetchall()
        cursor.close()

        lista = []
        for linha in resultados:
            lista.append({
                "id": linha[0],
                "usuarioId": linha[1],
                "lavouraId": linha[2],
                "gda": linha[3]
            })

        return jsonify(lista), 200
    except Exception as erro:
        return jsonify({"mensagem": "Erro ao buscar GDA", "erro": str(erro)}), 500