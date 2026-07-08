from flask import Blueprint, request, jsonify
import json

lavoura_bp = Blueprint('lavoura', __name__)
mysql = None  # vai ser injetado pelo app.py, igual fizemos no auth_routes

def init_mysql(mysql_instance):
    global mysql
    mysql = mysql_instance

@lavoura_bp.route('/lavoura', methods=['POST'])
def cadastrar_lavoura():
    dados = request.get_json()
    usuario_id = dados.get('usuarioId')
    nome_lavoura = dados.get('nomeLavoura')
    coordenadas = dados.get('coordenadas')  # lista de {lat, lng} vinda do Leaflet

    # validação básica
    if not usuario_id or not nome_lavoura or not coordenadas:
        return jsonify({"mensagem": "Todos os campos são obrigatórios"}), 400

    # o polígono precisa ter pelo menos 3 pontos pra fechar uma área
    if len(coordenadas) < 3:
        return jsonify({"mensagem": "O polígono precisa de pelo menos 3 pontos"}), 400

    # transforma a lista Python em texto JSON, pra guardar na coluna JSON do MySQL
    coordenadas_json = json.dumps(coordenadas)

    try:
        cursor = mysql.connection.cursor()
        cursor.execute(
            "INSERT INTO lavouras (usuario_id, nome_lavoura, coordenadas) VALUES (%s, %s, %s)",
            (usuario_id, nome_lavoura, coordenadas_json)
        )
        mysql.connection.commit()
        cursor.close()
        return jsonify({"mensagem": "Lavoura cadastrada com sucesso"}), 201
    except Exception as erro:
        return jsonify({"mensagem": "Erro ao cadastrar lavoura", "erro": str(erro)}), 500


@lavoura_bp.route('/lavouras/<int:usuario_id>', methods=['GET'])
def listar_lavouras(usuario_id):
    # essa rota busca todas as lavouras de um usuário específico,
    # pra você desenhar de volta no mapa quando ele fizer login
    try:
        cursor = mysql.connection.cursor()
        cursor.execute(
            "SELECT id, nome_lavoura, coordenadas, criado_em FROM lavouras WHERE usuario_id = %s",
            (usuario_id,)
        )
        resultados = cursor.fetchall()
        cursor.close()

        lavouras = []
        for linha in resultados:
            lavouras.append({
                "id": linha[0],
                "nomeLavoura": linha[1],
                "coordenadas": json.loads(linha[2]),  # transforma o JSON salvo de volta em lista
                "criadoEm": linha[3].isoformat()
            })

        return jsonify(lavouras), 200
    except Exception as erro:
        return jsonify({"mensagem": "Erro ao buscar lavouras", "erro": str(erro)}), 500