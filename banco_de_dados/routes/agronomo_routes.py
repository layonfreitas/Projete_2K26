from flask import Blueprint, request, jsonify

agronomo_bp = Blueprint('agronomo', __name__)
mysql = None  # vai ser injetado pelo app.py, igual nos outros arquivos de rota

def init_mysql(mysql_instance):
    global mysql
    mysql = mysql_instance


# Cooperativa direciona um produtor para um agrônomo
# (esse é o Marcos que vai chamar essa rota, mas o Thiago também
# precisa dela pronta pra poder ler os dados depois)
@agronomo_bp.route('/vincular', methods=['POST'])
def vincular_produtor():
    dados = request.get_json()
    agronomo_id = dados.get('agronomoId')
    produtor_id = dados.get('produtorId')

    if not agronomo_id or not produtor_id:
        return jsonify({"mensagem": "agronomoId e produtorId são obrigatórios"}), 400

    try:
        cursor = mysql.connection.cursor()
        # ON DUPLICATE KEY UPDATE: se o produtor já tinha um agrônomo,
        # troca pelo novo (útil pra redistribuição)
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


# Lista TODOS os produtores cadastrados, sem filtrar pelo vínculo com
# o agrônomo. É uma versão temporária: enquanto a tela da cooperativa
# (que cria os vínculos em /vincular) não existir, o agrônomo usa essa
# rota pra ver e escolher qualquer produtor. Quando a tela da
# cooperativa estiver pronta, troca essa rota pela de baixo
# (/agronomo/<agronomo_id>/produtores), que já filtra pela carteira certa.
@agronomo_bp.route('/produtores', methods=['GET'])
def listar_todos_produtores():
    try:
        cursor = mysql.connection.cursor()
        cursor.execute(
            "SELECT id, nome, email FROM usuarios WHERE tipo = 'produtor'"
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


# Agrônomo busca a carteira de produtores dele (pra montar a lista de seleção)
@agronomo_bp.route('/agronomo/<int:agronomo_id>/produtores', methods=['GET'])
def listar_produtores(agronomo_id):
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