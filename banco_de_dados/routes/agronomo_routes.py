from flask import Blueprint, request, jsonify

# Cria o Blueprint (igual auth_routes.py, lavoura_routes.py, etc)
agronomo_bp = Blueprint("agronomo_bp", __name__)

# Variável global que vai guardar a conexão MySQL recebida do app.py
mysql = None

def init_mysql(mysql_instance):
    global mysql
    mysql = mysql_instance


# A cooperativa direciona um produtor para um agrônomo responsável.
# Se o produtor já tinha um agrônomo, troca pelo novo (útil pra redistribuição).
@agronomo_bp.route('/vincular', methods=['POST'])
def vincular_produtor():
    dados = request.get_json()
    agronomo_id = dados.get('agronomoId')
    produtor_id = dados.get('produtorId')

    if not agronomo_id or not produtor_id:
        return jsonify({"mensagem": "agronomoId e produtorId são obrigatórios"}), 400

    try:
        cursor = mysql.connection.cursor()
        cursor.execute(
            """INSERT INTO vinculos_agronomo (agronomo_id, produtor_id)
               VALUES (%s, %s)
               ON DUPLICATE KEY UPDATE agronomo_id = %s""",
            (agronomo_id, produtor_id, agronomo_id)
        )
        mysql.connection.commit()
        cursor.close()
        return jsonify({"mensagem": "Produtor vinculado ao agrônomo com sucesso"}), 201
    except Exception as erro:
        return jsonify({"mensagem": "Erro ao vincular produtor", "erro": str(erro)}), 500


# Agrônomo busca a carteira de produtores dele (já filtrada pelo vínculo).
# Ainda não está sendo usada no front (que usa /produtores, todos),
# mas fica pronta pra quando a tela da cooperativa estiver em uso de verdade.
@agronomo_bp.route('/agronomo/<int:agronomo_id>/produtores', methods=['GET'])
def listar_produtores_do_agronomo(agronomo_id):
    try:
        cursor = mysql.connection.cursor()
        cursor.execute(
            """SELECT usuarios.id, usuarios.nome, usuarios.email
               FROM vinculos_agronomo
               JOIN usuarios ON usuarios.id = vinculos_agronomo.produtor_id
               WHERE vinculos_agronomo.agronomo_id = %s""",
            (agronomo_id,)
        )
        resultados = cursor.fetchall()
        cursor.close()

        produtores = [
            {"id": linha[0], "nome": linha[1], "email": linha[2]}
            for linha in resultados
        ]
        return jsonify(produtores), 200
    except Exception as erro:
        return jsonify({"mensagem": "Erro ao buscar produtores", "erro": str(erro)}), 500