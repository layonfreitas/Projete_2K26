from flask import Blueprint, request, jsonify, Response
import bcrypt
import csv
import io

from auth_utils import requer_tipo, init_mysql as init_auth_utils_mysql
from email_utils import enviar_email, montar_email_aviso

cooperativa_bp = Blueprint("cooperativa_bp", __name__)

mysql = None


def init_mysql(mysql_instance):
    global mysql
    mysql = mysql_instance
    init_auth_utils_mysql(mysql_instance)


# ================================================================
# GESTÃO DE USUÁRIOS
# ================================================================

# Cooperativa cadastra um novo usuário já escolhendo o tipo
# (produtor ou agronomo). Reaproveita a mesma lógica de hash
# de senha do /cadastro normal (routes/auth_routes.py).
@cooperativa_bp.route('/cooperativa/cadastrar-usuario', methods=['POST'])
@requer_tipo('cooperativa')
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
        novo_id = cursor.lastrowid
        cursor.close()
        return jsonify({"mensagem": "Usuário cadastrado com sucesso", "id": novo_id}), 201
    except Exception as erro:
        return jsonify({"mensagem": "Erro ao cadastrar usuário", "erro": str(erro)}), 500


# Lista todos os agrônomos e produtores, com o agrônomo vinculado
# (se já houver um) para cada produtor. É a tabela principal da
# tela da cooperativa.
@cooperativa_bp.route('/cooperativa/usuarios', methods=['GET'])
@requer_tipo('cooperativa')
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


# Editar nome/email de um produtor ou agrônomo.
@cooperativa_bp.route('/cooperativa/usuario/<int:usuario_id>', methods=['PUT'])
@requer_tipo('cooperativa')
def editar_usuario(usuario_id):
    dados = request.get_json()
    nome = dados.get('nome')
    email = dados.get('email')

    if not nome or not email:
        return jsonify({"mensagem": "nome e email são obrigatórios"}), 400

    try:
        cursor = mysql.connection.cursor()
        cursor.execute("SELECT tipo FROM usuarios WHERE id = %s", (usuario_id,))
        existente = cursor.fetchone()
        if not existente or existente[0] not in ('produtor', 'agronomo'):
            cursor.close()
            return jsonify({"mensagem": "Usuário não encontrado"}), 404

        cursor.execute(
            "UPDATE usuarios SET nome = %s, confirma_nome = %s, email = %s WHERE id = %s",
            (nome, nome, email, usuario_id)
        )
        mysql.connection.commit()
        cursor.close()
        return jsonify({"mensagem": "Usuário atualizado com sucesso"}), 200
    except Exception as erro:
        return jsonify({"mensagem": "Erro ao editar usuário", "erro": str(erro)}), 500


# Deleta um produtor ou agrônomo de verdade (não é soft-delete).
# Antes de apagar o usuário, remove tudo que depende dele pra não
# quebrar as foreign keys: observações -> imagens -> lavouras ->
# vínculo com agrônomo -> o usuário em si.
@cooperativa_bp.route('/cooperativa/usuario/<int:usuario_id>', methods=['DELETE'])
@requer_tipo('cooperativa')
def deletar_usuario(usuario_id):
    try:
        cursor = mysql.connection.cursor()

        cursor.execute("SELECT tipo FROM usuarios WHERE id = %s", (usuario_id,))
        existente = cursor.fetchone()
        if not existente or existente[0] not in ('produtor', 'agronomo'):
            cursor.close()
            return jsonify({"mensagem": "Usuário não encontrado"}), 404

        tipo = existente[0]

        if tipo == 'produtor':
            # observações das lavouras desse produtor
            cursor.execute(
                "DELETE observacoes FROM observacoes "
                "JOIN lavouras ON lavouras.id = observacoes.lavoura_id "
                "WHERE lavouras.usuario_id = %s",
                (usuario_id,)
            )
            # imagens/índices ligados às lavouras desse produtor
            cursor.execute("DELETE FROM imagens WHERE usuario_id = %s", (usuario_id,))
            # lavouras do produtor
            cursor.execute("DELETE FROM lavouras WHERE usuario_id = %s", (usuario_id,))
            # vínculo com o agrônomo, se houver
            cursor.execute("DELETE FROM vinculos_agronomo WHERE produtor_id = %s", (usuario_id,))
        else:  # agronomo
            # desfaz os vínculos onde ele era o responsável
            cursor.execute("DELETE FROM vinculos_agronomo WHERE agronomo_id = %s", (usuario_id,))

        cursor.execute("DELETE FROM usuarios WHERE id = %s", (usuario_id,))
        mysql.connection.commit()
        cursor.close()

        return jsonify({"mensagem": "Usuário e dados vinculados excluídos com sucesso"}), 200
    except Exception as erro:
        mysql.connection.rollback()
        return jsonify({"mensagem": "Erro ao excluir usuário", "erro": str(erro)}), 500


# ================================================================
# DASHBOARD CONSOLIDADO
# ================================================================

@cooperativa_bp.route('/cooperativa/dashboard', methods=['GET'])
@requer_tipo('cooperativa')
def dashboard():
    try:
        cursor = mysql.connection.cursor()

        cursor.execute("SELECT COUNT(*) FROM usuarios WHERE tipo = 'produtor'")
        total_produtores = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM usuarios WHERE tipo = 'agronomo'")
        total_agronomos = cursor.fetchone()[0]

        cursor.execute(
            "SELECT COUNT(*) FROM usuarios WHERE tipo = 'produtor' "
            "AND id NOT IN (SELECT produtor_id FROM vinculos_agronomo)"
        )
        produtores_sem_agronomo = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM lavouras")
        total_lavouras = cursor.fetchone()[0]

        cursor.execute(
            "SELECT status, COUNT(*) FROM lavouras GROUP BY status"
        )
        contagem_status = {linha[0]: linha[1] for linha in cursor.fetchall()}

        # lista das lavouras em estado crítico/atenção, pra cooperativa ver rápido onde olhar
        cursor.execute(
            """SELECT lavouras.id, lavouras.nome_lavoura, lavouras.status,
                      usuarios.nome AS produtor_nome
               FROM lavouras
               JOIN usuarios ON usuarios.id = lavouras.usuario_id
               WHERE lavouras.status IN ('atencao', 'critico')
               ORDER BY FIELD(lavouras.status, 'critico', 'atencao')"""
        )
        lavouras_em_alerta = [
            {"id": l[0], "nomeLavoura": l[1], "status": l[2], "produtor": l[3]}
            for l in cursor.fetchall()
        ]

        cursor.close()

        return jsonify({
            "totalProdutores": total_produtores,
            "totalAgronomos": total_agronomos,
            "produtoresSemAgronomo": produtores_sem_agronomo,
            "totalLavouras": total_lavouras,
            "statusLavouras": {
                "ok": contagem_status.get("ok", 0),
                "atencao": contagem_status.get("atencao", 0),
                "critico": contagem_status.get("critico", 0),
            },
            "lavourasEmAlerta": lavouras_em_alerta,
        }), 200
    except Exception as erro:
        return jsonify({"mensagem": "Erro ao montar dashboard", "erro": str(erro)}), 500


# ================================================================
# RANKING POR AGRÔNOMO
# ================================================================

@cooperativa_bp.route('/cooperativa/ranking-agronomos', methods=['GET'])
@requer_tipo('cooperativa')
def ranking_agronomos():
    try:
        cursor = mysql.connection.cursor()
        cursor.execute(
            """SELECT
                   usuarios.id,
                   usuarios.nome,
                   COUNT(DISTINCT vinculos_agronomo.produtor_id) AS total_produtores,
                   COUNT(DISTINCT lavouras.id) AS total_lavouras,
                   SUM(CASE WHEN lavouras.status = 'critico' THEN 1 ELSE 0 END) AS lavouras_criticas
               FROM usuarios
               LEFT JOIN vinculos_agronomo ON vinculos_agronomo.agronomo_id = usuarios.id
               LEFT JOIN lavouras ON lavouras.usuario_id = vinculos_agronomo.produtor_id
               WHERE usuarios.tipo = 'agronomo'
               GROUP BY usuarios.id, usuarios.nome
               ORDER BY total_produtores DESC"""
        )
        resultados = cursor.fetchall()
        cursor.close()

        ranking = [
            {
                "id": r[0],
                "nome": r[1],
                "totalProdutores": r[2],
                "totalLavouras": r[3],
                "lavourasCriticas": r[4] or 0,
            }
            for r in resultados
        ]
        return jsonify(ranking), 200
    except Exception as erro:
        return jsonify({"mensagem": "Erro ao montar ranking", "erro": str(erro)}), 500


# ================================================================
# RELATÓRIO (CSV)
# ================================================================

@cooperativa_bp.route('/cooperativa/relatorio.csv', methods=['GET'])
@requer_tipo('cooperativa')
def relatorio_csv():
    try:
        cursor = mysql.connection.cursor()
        cursor.execute(
            """SELECT
                   usuarios.nome AS produtor,
                   agronomo.nome AS agronomo,
                   lavouras.nome_lavoura,
                   lavouras.status,
                   lavouras.criado_em
               FROM lavouras
               JOIN usuarios ON usuarios.id = lavouras.usuario_id
               LEFT JOIN vinculos_agronomo ON vinculos_agronomo.produtor_id = usuarios.id
               LEFT JOIN usuarios AS agronomo ON agronomo.id = vinculos_agronomo.agronomo_id
               ORDER BY usuarios.nome"""
        )
        linhas = cursor.fetchall()
        cursor.close()

        buffer = io.StringIO()
        escritor = csv.writer(buffer)
        escritor.writerow(["Produtor", "Agrônomo", "Lavoura", "Status", "Cadastrada em"])
        for l in linhas:
            escritor.writerow([l[0], l[1] or "Sem agrônomo", l[2], l[3], l[4]])

        return Response(
            buffer.getvalue(),
            mimetype="text/csv",
            headers={"Content-Disposition": "attachment; filename=relatorio_coffeevision.csv"}
        )
    except Exception as erro:
        return jsonify({"mensagem": "Erro ao gerar relatório", "erro": str(erro)}), 500


# ================================================================
# AVISOS / COMUNICADOS
# ================================================================

@cooperativa_bp.route('/cooperativa/avisos', methods=['POST'])
@requer_tipo('cooperativa')
def criar_aviso():
    dados = request.get_json()
    titulo = dados.get('titulo')
    mensagem = dados.get('mensagem')
    destinatario_tipo = dados.get('destinatarioTipo', 'todos')
    cooperativa_id = request.headers.get('X-Usuario-Id')

    if not titulo or not mensagem:
        return jsonify({"mensagem": "titulo e mensagem são obrigatórios"}), 400

    if destinatario_tipo not in ('todos', 'produtores', 'agronomos'):
        return jsonify({"mensagem": "destinatarioTipo inválido"}), 400

    try:
        cursor = mysql.connection.cursor()
        cursor.execute(
            """INSERT INTO avisos (cooperativa_id, titulo, mensagem, destinatario_tipo)
               VALUES (%s, %s, %s, %s)""",
            (cooperativa_id, titulo, mensagem, destinatario_tipo)
        )
        mysql.connection.commit()

        # Busca os e-mails de quem deve receber, conforme o destinatarioTipo
        if destinatario_tipo == 'todos':
            cursor.execute("SELECT email FROM usuarios WHERE tipo IN ('produtor', 'agronomo')")
        elif destinatario_tipo == 'produtores':
            cursor.execute("SELECT email FROM usuarios WHERE tipo = 'produtor'")
        else:  # 'agronomos'
            cursor.execute("SELECT email FROM usuarios WHERE tipo = 'agronomo'")

        emails = [linha[0] for linha in cursor.fetchall()]
        cursor.close()

        # Manda o e-mail pra cada destinatário. Um e-mail que falhar não
        # derruba a resposta inteira (o aviso já foi salvo com sucesso) —
        # só registra no log do servidor pra investigar depois.
        html, texto = montar_email_aviso(titulo, mensagem)
        falhas = []
        for email in emails:
            try:
                enviar_email(email, f"CoffeeVision — {titulo}", html, texto)
            except Exception as erro_email:
                falhas.append(email)
                print(f"Erro ao enviar aviso por e-mail para {email}: {erro_email}")

        resposta = {"mensagem": "Aviso enviado com sucesso", "emailsEnviados": len(emails) - len(falhas)}
        if falhas:
            resposta["emailsComFalha"] = len(falhas)

        return jsonify(resposta), 201
    except Exception as erro:
        return jsonify({"mensagem": "Erro ao criar aviso", "erro": str(erro)}), 500


# Lista os avisos relevantes para o tipo de usuário que está pedindo
# (usado tanto pela cooperativa pra ver o histórico, quanto pelo
# produtor/agrônomo pra ver o que recebeu).
@cooperativa_bp.route('/avisos', methods=['GET'])
def listar_avisos():
    tipo_usuario = request.args.get('tipo', 'todos')

    try:
        cursor = mysql.connection.cursor()
        cursor.execute(
            """SELECT id, titulo, mensagem, destinatario_tipo, criado_em
               FROM avisos
               WHERE destinatario_tipo = 'todos' OR destinatario_tipo = %s
               ORDER BY criado_em DESC""",
            (tipo_usuario,)
        )
        resultados = cursor.fetchall()
        cursor.close()

        avisos = [
            {
                "id": a[0],
                "titulo": a[1],
                "mensagem": a[2],
                "destinatarioTipo": a[3],
                "criadoEm": a[4].isoformat(),
            }
            for a in resultados
        ]
        return jsonify(avisos), 200
    except Exception as erro:
        return jsonify({"mensagem": "Erro ao listar avisos", "erro": str(erro)}), 500

@cooperativa_bp.route("/usuario/<int:usuario_id>/senha", methods=["PUT"])
def senha_edit(usuario_id):
    dados= request.get_json()
    nova_senha = dados.get("senha")

    if not nova_senha or len(nova_senha)<6:
        return jsonify({"mensagem":"senha invalida"}), 400

    senha_hash = bcrypt.hashpw(nova_senha.encode("utf-8"), bcrypt.gensalt())

    cursor = mysql.conection.cursor()
    cursor.execute(
        "UPDATE usuarios Set senha = % WHERE id=%s",
        (senha_hash.decode("utf-8"), usuario_id)
    )
    mysql.conection.commit()
    cursor.close()

    return jsonify({"mensagem": "Senha altearada com sucesso."}),200


@cooperativa_bp.route("/desvincular", methods=["POST"])
def desvincular():
    dados = request.get_json()
    produtor_id = dados.get("produtorId")
    agronomo_id = dados.get("agronomoId")

    if not produtor_id or not agronomo_id:
        return jsonify({"mensagem": "Produtor e agrônomo são obrigatórios"}), 400

    cursor = mysql.connection.cursor()
    try:
        cursor.execute(
            "SELECT id FROM vinculos_agronomo WHERE produtor_id = %s AND agronomo_id = %s",
            (produtor_id, agronomo_id)
        )
        if cursor.fetchone() is None:
            return jsonify({"mensagem": "Vínculo não encontrado."}), 404

        cursor.execute(
            "DELETE FROM vinculos_agronomo WHERE produtor_id = %s AND agronomo_id = %s",
            (produtor_id, agronomo_id)
        )
        mysql.connection.commit()
        return jsonify({"mensagem": "Produtor desvinculado com sucesso."}), 200
    except Exception as erro:
        mysql.connection.rollback()
        return jsonify({"mensagem": "Erro ao desvincular produtor.", "erro": str(erro)}), 500
    finally:
        cursor.close()