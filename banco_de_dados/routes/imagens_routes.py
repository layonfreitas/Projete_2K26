from flask import Blueprint, request, jsonify

cadastrar_imagens_bp = Blueprint('cadastrar_imagens', __name__)
acessar_imagem_bp = Blueprint('acessar_imagem', __name__)
listar_imagens_bp = Blueprint('listar_imagens', __name__)
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
    id = request.args.get('id')
    usuario_id = request.args.get('usuario_id')
    data = request.args.get('data')
    indice = request.args.get('indice')

    try:
        cursor = mysql.connection.cursor()
        cursor.execute("SELECT coordenadas FROM lavouras WHERE id = %s AND usuario_id = %s", (id, usuario_id))
        linha_coordenadas = cursor.fetchone()
        coordenadas = linha_coordenadas[0]
        cursor.execute("SELECT url_imagem FROM imagens WHERE lavoura_id = %s AND usuario_id = %s AND data_imagem= %s AND indice = %s", (id, usuario_id, data, indice))
        linha_url = cursor.fetchone()
        url = linha_url[0]

        return jsonify({"coordenadas":coordenadas, "url": url}), 200


    except Exception as erro:
        return jsonify({"mensagem": "Não foi possível encontrar dos dados.", "erro": str(erro)}),500


@listar_imagens_bp.route('/imagens/<int:lavoura_id>', methods=['GET'])
def listar_imagens(lavoura_id):
    usuario_id = request.args.get('usuario_id')
    if not usuario_id:
        return jsonify({"mensagem": "Parâmetro 'usuario_id' é obrigatório"}), 400
 
    try:
        cursor = mysql.connection.cursor()
        cursor.execute(
            "SELECT DISTINCT data_imagem, indice FROM imagens "
            "WHERE lavoura_id = %s AND usuario_id = %s "
            "ORDER BY data_imagem DESC",
            (lavoura_id, usuario_id)
        )
        linhas = cursor.fetchall()
        cursor.close()
 
        agrupado = {}
        ordem_datas = []
        for data_imagem, indice in linhas:
            data_str = data_imagem.isoformat() if hasattr(data_imagem, 'isoformat') else str(data_imagem)
            if data_str not in agrupado:
                agrupado[data_str] = []
                ordem_datas.append(data_str)
            agrupado[data_str].append(indice)
 
        resultado = [
            {"data": data_str, "indicesDisponiveis": agrupado[data_str]}
            for data_str in ordem_datas
        ]
 
        return jsonify(resultado), 200
    except Exception as erro:
        return jsonify({"mensagem": "Erro ao buscar imagens", "erro": str(erro)}), 500