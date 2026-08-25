from flask import Blueprint, request, jsonify
from flask_mysqldb import MySQL
import bcrypt

auth_bp = Blueprint('auth', __name__)
mysql = None  # vai ser injetado pelo app.py

def init_mysql(mysql_instance):
    global mysql
    mysql = mysql_instance

@auth_bp.route('/cadastro', methods=['POST'])
def cadastro():
    dados = request.get_json()
    nome = dados.get('nome')
    confirma_nome = dados.get('confirmaNome')
    email = dados.get('email')
    senha = dados.get('senha')
    confirma_senha = dados.get('confirmaSenha')

    if not nome or not confirma_nome or not email or not senha or not confirma_senha:
        return jsonify({"mensagem": "Todos os campos são obrigatórios"}), 400

    if nome != confirma_nome:
        return jsonify({"mensagem": "Os nomes não coincidem"}), 400
    if senha != confirma_senha:
        return jsonify({"mensagem": "As senhas não coincidem"}), 400

    senha_hash = bcrypt.hashpw(senha.encode('utf-8'), bcrypt.gensalt())
    confirma_senha_hash = bcrypt.hashpw(confirma_senha.encode('utf-8'), bcrypt.gensalt())

    try:
        cursor = mysql.connection.cursor()
        cursor.execute(
            "INSERT INTO usuarios (nome, confirma_nome, email, senha_hash, confirma_senha_hash) VALUES (%s, %s, %s, %s, %s)",
            (nome, confirma_nome, email, senha_hash, confirma_senha_hash)
        )
        mysql.connection.commit()
        cursor.close()
        return jsonify({"mensagem": "Usuário cadastrado com sucesso"}), 201
    except Exception as erro:
        return jsonify({"mensagem": "Erro ao cadastrar", "erro": str(erro)}), 500


@auth_bp.route('/login', methods=['POST'])
def login():
    dados = request.get_json()
    email = dados.get('email')
    senha = dados.get('senha')

    if not email or not senha:
        return jsonify({"mensagem": "E-mail e senha são obrigatórios"}), 400

    try:
        cursor = mysql.connection.cursor()
        cursor.execute(
            "SELECT id, nome, senha_hash, tipo FROM usuarios WHERE email = %s",
            (email,)
        )
        resultado = cursor.fetchone()
        cursor.close()

        senha_hash_salva = resultado[2] if resultado else None
        if isinstance(senha_hash_salva, str):
            senha_hash_salva = senha_hash_salva.encode('utf-8')

        if resultado and bcrypt.checkpw(senha.encode('utf-8'), senha_hash_salva):
            return jsonify({
                "mensagem": "Login realizado com sucesso",
                "usuarioId": resultado[0],
                "nome": resultado[1],
                "tipo": resultado[3]
            }), 200
        else:
            return jsonify({"mensagem": "E-mail ou senha incorretos"}), 401
    except Exception as erro:
        return jsonify({"mensagem": "Erro ao fazer login", "erro": str(erro)}), 500


@auth_bp.route('/produtores', methods=['GET'])
def listar_produtores():
    try:
        cursor = mysql.connection.cursor()
        cursor.execute("SELECT id, nome, email FROM usuarios WHERE tipo = 'produtor'")
        produtores = cursor.fetchall()
        cursor.close()

        produtores_list = [{"id": p[0], "nome": p[1], "email": p[2]} for p in produtores]
        return jsonify(produtores_list), 200
    except Exception as erro:
        return jsonify({"mensagem": "Erro ao listar produtores", "erro": str(erro)}), 500

@auth_bp.route("/observacoes", methods=["POST"])
def criar_observacao():

    dados = request.get_json()

    texto = dados.get("texto")

    if not texto:
        return jsonify({
            "erro": "Observação não informada"
        }), 400

    cursor = mysql.connection.cursor()

    cursor.execute(
        "INSERT INTO observacoes (texto) VALUES (%s)",
        (texto,)
    )

    mysql.connection.commit()

    cursor.close()

    return jsonify({
        "mensagem": "Observação salva com sucesso"
    }), 201