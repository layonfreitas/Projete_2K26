from flask import Blueprint, request, jsonify

cadastrar_imagens_bp = Blueprint('cadastrar_imagens', __name__)
acessar_imagem_bp = Blueprint('acessar_imagem', __name__)
mysql = None  # vai ser injetado pelo app.py

def init_mysql(mysql_instance):
    global mysql
    mysql = mysql_instance


@cadastrar_imagens_bp.route('/imagens', methods=['POST'])
def cadastrar_imagem():
    dados = request.get_json()
    usuario_id = dados.get('usuarioId')
    lavoura_id = dados.get('lavouraId')
    data_imagem = dados.get('dataImagem')
    url_imagem = dados.get('urlImagem')
    indice = dados.get('indice')  # Novo campo para o índice

    # validação básica
    if not usuario_id or not data_imagem or not url_imagem or not lavoura_id:
        return jsonify({"mensagem": "Todos os campos são obrigatórios"}), 400

    try:
        cursor = mysql.connection.cursor()
        cursor.execute(
            "INSERT INTO imagens (usuario_id, lavoura_id, data_imagem, url_imagem, indice) VALUES (%s, %s, %s, %s, %s)",
            (usuario_id, lavoura_id, data_imagem, url_imagem, indice)
        )
        mysql.connection.commit()
        cursor.close()
        return jsonify({"mensagem": "Imagem cadastrada com sucesso"}), 201
    except Exception as erro:
        return jsonify({"mensagem": "Erro ao cadastrar imagem", "erro": str(erro)}), 500
    

@acessar_imagem_bp.route('/acessar_imagem', methods=['GET'])
def acessar_imagem():
    dados = request.get_json()
    id = dados.get('id')
    data = dados.get('data')
    indice = dados.get('indice')

    try:
        cursor = mysql.connection.cursor()
        cursor.execute("SELECT coordenadas FROM lavouras WHERE id = %s", (id))


    except Exception as erro:
        return jsonify({"mensagem": "Não foi possível encontrar dos dados."}),500
