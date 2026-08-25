from flask import Blueprint, request, jsonify
import bcrypt

cooperativa_bp = Blueprint("cooperativa_bp", __name__)

mysql = None

def init_mysql(mysql_instance):
    global mysql
    mysql = mysql_instance


# Cooperativa cadastra um novo usuário já escolhendo o tipo
# (produtor ou agronomo). Reaproveita a mesma lógica de hash
# de senha do /cadastro normal (routes/auth_routes.py).
@cooperativa_bp.route('/cooperativa/cadastrar-usuario', methods=['POST'])
def cadastrar_usuario():
    dados = request.get_json()
    nome = dados.get('nome')
    email = dados.get('email')
    senha = dados.get('senha')
    tipo = dados.get('tipo')  # 'produtor' ou 'agronomo'

    if not nome or not email or not senha or not tipo:
        return jsonify({"mensagem": "nome, email, senha e tipo são obrigatórios"}), 400

    if tipo not in ('produtor', 'agronomo'):
        return jsonify({"mensagem": "tipo deve ser 'produtor' ou 'agronomo'"}), 400

    senha_hash = bcrypt.hashpw(senha.encode('utf-8'), bcrypt.gensalt())

    try:
        cursor = mysql.connection.cursor()
        cursor.execute(
            """INSERT INTO usuarios (nome, confirma_nome, email, senha_hash, confirma_senha_hash, tipo)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            (nome, nome, email, senha_hash, senha_hash, tipo)
        )
        mysql.connection.commit()
        cursor.close()
        return jsonify({"mensagem": "Usuário cadastrado com sucesso"}), 201
    except Exception as erro:
        return jsonify({"mensagem": "Erro ao cadastrar usuário", "erro": str(erro)}), 500


# Lista todos os agrônomos e produtores, com o agrônomo vinculado
# (se já houver um) para cada produtor. É a tabela principal da
# tela da cooperativa.
@cooperativa_bp.route('/cooperativa/usuarios', methods=['GET'])
def listar_usuarios():
    try:
        cursor = mysql.connection.cursor()
        cursor.execute(
            """SELECT
                   usuarios.id,
                   usuarios.nome,
                   usuarios.email,
                   usuarios.tipo,
                   vinculos_agronomo.agronomo_id
               FROM usuarios
               LEFT JOIN vinculos_agronomo
                   ON vinculos_agronomo.produtor_id = usuarios.id
               WHERE usuarios.tipo IN ('produtor', 'agronomo')
               ORDER BY usuarios.tipo, usuarios.nome"""
        )
        resultados = cursor.fetchall()
        cursor.close()

        usuarios = [
            {
                "id": linha[0],
                "nome": linha[1],
                "email": linha[2],
                "tipo": linha[3],
                "agronomoId": linha[4],
            }
            for linha in resultados
        ]
        return jsonify(usuarios), 200
    except Exception as erro:
        return jsonify({"mensagem": "Erro ao listar usuários", "erro": str(erro)}), 500