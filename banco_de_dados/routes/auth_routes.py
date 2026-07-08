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