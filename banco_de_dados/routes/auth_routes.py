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
    lavoura_id = dados.get("lavoura_id")
    autor_id = dados.get("autor_id")  # NOVO: quem está escrevendo (opcional)
 
    if not texto:
        return jsonify({
            "erro": "Observação não informada"
        }), 400
 
    if not lavoura_id:
        return jsonify({
            "erro": "Lavoura não informada"
        }), 400
 
    try:
 
        cursor = mysql.connection.cursor()
 
        cursor.execute(
            """
            INSERT INTO observacoes (lavoura_id, texto, autor_id)
            VALUES (%s, %s, %s)
            """,
            (lavoura_id, texto, autor_id)
        )
 
        # Se quem escreveu não é o dono da lavoura, é um agrônomo agindo
        # em nome do produtor -> registra no log de auditoria (transparência,
        # espec seção 3.2) e avisa POR E-MAIL só o dono dessa lavoura
        # específica -- nunca os outros produtores da carteira do agrônomo.
        if autor_id:
            cursor.execute(
                "SELECT usuario_id, nome_lavoura FROM lavouras WHERE id = %s",
                (lavoura_id,)
            )
            resultado_lavoura = cursor.fetchone()
            dono_id = resultado_lavoura[0] if resultado_lavoura else None
            nome_lavoura = resultado_lavoura[1] if resultado_lavoura else "sua lavoura"
 
            if dono_id and str(dono_id) != str(autor_id):
                registrar_log_auditoria(
                    cursor,
                    lavoura_id=lavoura_id,
                    autor_id=autor_id,
                    produtor_id=dono_id,
                    acao="registrou_observacao",
                    detalhe=texto[:200],
                )
 
                # busca nome do agrônomo e e-mail/nome do dono da lavoura
                cursor.execute("SELECT nome FROM usuarios WHERE id = %s", (autor_id,))
                linha_agronomo = cursor.fetchone()
                nome_agronomo = linha_agronomo[0] if linha_agronomo else "Seu agrônomo"
 
                cursor.execute("SELECT email FROM usuarios WHERE id = %s", (dono_id,))
                linha_produtor = cursor.fetchone()
                email_produtor = linha_produtor[0] if linha_produtor else None
 
        mysql.connection.commit()
        cursor.close()
 
        # E-mail é enviado DEPOIS do commit, e só falha silenciosamente
        # (a observação já foi salva -- não queremos que um problema no
        # envio de e-mail derrube a resposta de sucesso pro usuário).
        if autor_id and dono_id and str(dono_id) != str(autor_id) and email_produtor:
            try:
                html, texto_email = montar_email_observacao(nome_agronomo, nome_lavoura, texto)
                enviar_email(
                    email_produtor,
                    f"CoffeeVision — Nova observação em {nome_lavoura}",
                    html,
                    texto_email,
                )
            except Exception as erro_email:
                print(f"Erro ao enviar e-mail de observação para {email_produtor}: {erro_email}")
 
        return jsonify({
            "mensagem": "Observação salva com sucesso"
        }), 201
 
    except Exception as erro:
 
        mysql.connection.rollback()
        print("Erro ao salvar observação:", erro)
 
        return jsonify({
            "erro": str(erro)
        }), 500

@auth_bp.route("/observacoes/<int:lavoura_id>", methods=["GET"])
def buscar_observacoes(lavoura_id):

    try:

        cursor = mysql.connection.cursor()

        cursor.execute(
            """
            SELECT id, texto
            FROM observacoes
            WHERE lavoura_id = %s
            """,
            (lavoura_id,)
        )

        observacoes = cursor.fetchall()

        cursor.close()

        resultado = []

        for observacao in observacoes:
            resultado.append({
                "id": observacao[0],
                "texto": observacao[1]
            })

        return jsonify(resultado), 200

    except Exception as erro:

        print("Erro ao buscar observações:", erro)

        return jsonify({
            "erro": str(erro)
        }), 500