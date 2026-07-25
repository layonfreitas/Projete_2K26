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
    senha = dados.get('senha')
    confirma_senha = dados.get('confirmaSenha')

    # validação básica de campos obrigatórios
    if not nome or not confirma_nome or not senha or not confirma_senha:
        return jsonify({"mensagem": "Todos os campos são obrigatórios"}), 400

    # validação de conferência (reforço, já que o front também valida)
    if nome != confirma_nome:
        return jsonify({"mensagem": "Os nomes não coincidem"}), 400
    if senha != confirma_senha:
        return jsonify({"mensagem": "As senhas não coincidem"}), 400

    # gera hash pra senha e pra confirmação
    senha_hash = bcrypt.hashpw(senha.encode('utf-8'), bcrypt.gensalt())
    confirma_senha_hash = bcrypt.hashpw(confirma_senha.encode('utf-8'), bcrypt.gensalt())

    try:
        cursor = mysql.connection.cursor()
        cursor.execute(
            "INSERT INTO usuarios (nome, confirma_nome, senha_hash, confirma_senha_hash) VALUES (%s, %s, %s, %s)",
            (nome, confirma_nome, senha_hash, confirma_senha_hash)
        )
        mysql.connection.commit()
        cursor.close()
        return jsonify({"mensagem": "Usuário cadastrado com sucesso"}), 201
    except Exception as erro:
        # erro comum aqui: nome duplicado (por causa do UNIQUE)
        return jsonify({"mensagem": "Erro ao cadastrar", "erro": str(erro)}), 500


@auth_bp.route('/login', methods=['POST'])
def login():
    dados = request.get_json()
    nome = dados.get('nome')
    senha = dados.get('senha')

    if not nome or not senha:
        return jsonify({"mensagem": "Nome e senha são obrigatórios"}), 400

    try:
        cursor = mysql.connection.cursor()
        cursor.execute(
            "SELECT id, nome, senha_hash FROM usuarios WHERE nome = %s",
            (nome,)
        )
        resultado = cursor.fetchone()
        cursor.close()

        # verifica se o usuário existe e se a senha bate com o hash salvo
        # (o hash pode vir como str ou bytes do banco, então tratamos os dois casos)
        senha_hash_salva = resultado[2] if resultado else None
        if isinstance(senha_hash_salva, str):
            senha_hash_salva = senha_hash_salva.encode('utf-8')

        if resultado and bcrypt.checkpw(senha.encode('utf-8'), senha_hash_salva):
            return jsonify({
                "mensagem": "Login realizado com sucesso",
                "usuarioId": resultado[0],
                "nome": resultado[1]
            }), 200
        else:
            return jsonify({"mensagem": "Nome ou senha incorretos"}), 401
    except Exception as erro:
        return jsonify({"mensagem": "Erro ao fazer login", "erro": str(erro)}), 500