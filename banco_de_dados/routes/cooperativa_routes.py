from flask import Blueprint, request, jsonify, Response, current_app
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

@cooperativa_bp.route(
    "/cooperativa/cadastrar-usuario",
    methods=["POST"]
)
@requer_tipo("cooperativa")
def cadastrar_usuario():
    dados = request.get_json(silent=True)

    if not isinstance(dados, dict):
        return jsonify({"mensagem": "Dados inválidos."}), 400

    nome = dados.get("nome")
    email = dados.get("email")
    senha = dados.get("senha")
    tipo = dados.get("tipo")

    if not nome or not email or not senha or not tipo:
        return jsonify({
            "mensagem": "nome, email, senha e tipo são obrigatórios"
        }), 400

    if tipo not in ("produtor", "agronomo"):
        return jsonify({
            "mensagem": "tipo deve ser 'produtor' ou 'agronomo'"
        }), 400

    if not isinstance(senha, str):
        return jsonify({"mensagem": "Senha inválida."}), 400

    senha_hash = bcrypt.hashpw(
        senha.encode("utf-8"),
        bcrypt.gensalt()
    )

    cursor = None

    try:
        cursor = mysql.connection.cursor()

        cursor.execute(
            """
            INSERT INTO usuarios (
                nome,
                confirma_nome,
                email,
                senha_hash,
                confirma_senha_hash,
                tipo
            )
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (nome, nome, email, senha_hash, senha_hash, tipo)
        )

        novo_id = cursor.lastrowid
        mysql.connection.commit()

        return jsonify({
            "mensagem": "Usuário cadastrado com sucesso",
            "id": novo_id
        }), 201

    except Exception:
        if cursor is not None:
            mysql.connection.rollback()

        current_app.logger.exception("Erro ao cadastrar usuário")

        return jsonify({
            "mensagem": "Erro ao cadastrar usuário."
        }), 500

    finally:
        if cursor is not None:
            cursor.close()


@cooperativa_bp.route("/cooperativa/usuarios", methods=["GET"])
@requer_tipo("cooperativa")
def listar_usuarios():
    cursor = None

    try:
        cursor = mysql.connection.cursor()

        cursor.execute(
            """
            SELECT
                usuarios.id,
                usuarios.nome,
                usuarios.email,
                usuarios.tipo,
                vinculos_agronomo.agronomo_id
            FROM usuarios
            LEFT JOIN vinculos_agronomo
                ON vinculos_agronomo.produtor_id = usuarios.id
            WHERE usuarios.tipo IN ('produtor', 'agronomo')
            ORDER BY usuarios.tipo, usuarios.nome
            """
        )

        usuarios = [
            {
                "id": linha[0],
                "nome": linha[1],
                "email": linha[2],
                "tipo": linha[3],
                "agronomoId": linha[4],
            }
            for linha in cursor.fetchall()
        ]

        return jsonify(usuarios), 200

    except Exception:
        current_app.logger.exception("Erro ao listar usuários")

        return jsonify({
            "mensagem": "Erro ao listar usuários."
        }), 500

    finally:
        if cursor is not None:
            cursor.close()


@cooperativa_bp.route(
    "/cooperativa/usuario/<int:usuario_id>",
    methods=["PUT"]
)
@requer_tipo("cooperativa")
def editar_usuario(usuario_id):
    dados = request.get_json(silent=True)

    if not isinstance(dados, dict):
        return jsonify({"mensagem": "Dados inválidos."}), 400

    nome = dados.get("nome")
    email = dados.get("email")

    if not nome or not email:
        return jsonify({
            "mensagem": "nome e email são obrigatórios"
        }), 400

    cursor = None

    try:
        cursor = mysql.connection.cursor()

        cursor.execute(
            "SELECT tipo FROM usuarios WHERE id = %s",
            (usuario_id,)
        )

        existente = cursor.fetchone()

        if not existente or existente[0] not in ("produtor", "agronomo"):
            return jsonify({
                "mensagem": "Usuário não encontrado"
            }), 404

        cursor.execute(
            """
            UPDATE usuarios
            SET nome = %s,
                confirma_nome = %s,
                email = %s
            WHERE id = %s
            """,
            (nome, nome, email, usuario_id)
        )

        mysql.connection.commit()

        return jsonify({
            "mensagem": "Usuário atualizado com sucesso"
        }), 200

    except Exception:
        if cursor is not None:
            mysql.connection.rollback()

        current_app.logger.exception("Erro ao editar usuário")

        return jsonify({
            "mensagem": "Erro ao editar usuário."
        }), 500

    finally:
        if cursor is not None:
            cursor.close()


@cooperativa_bp.route(
    "/cooperativa/usuario/<int:usuario_id>",
    methods=["DELETE"]
)
@requer_tipo("cooperativa")
def deletar_usuario(usuario_id):
    cursor = None

    try:
        cursor = mysql.connection.cursor()

        cursor.execute(
            "SELECT tipo FROM usuarios WHERE id = %s",
            (usuario_id,)
        )

        existente = cursor.fetchone()

        if not existente or existente[0] not in ("produtor", "agronomo"):
            return jsonify({
                "mensagem": "Usuário não encontrado"
            }), 404

        if existente[0] == "produtor":
            cursor.execute(
                """
                DELETE observacoes
                FROM observacoes
                JOIN lavouras
                    ON lavouras.id = observacoes.lavoura_id
                WHERE lavouras.usuario_id = %s
                """,
                (usuario_id,)
            )

            cursor.execute(
                "DELETE FROM imagens WHERE usuario_id = %s",
                (usuario_id,)
            )

            cursor.execute(
                "DELETE FROM lavouras WHERE usuario_id = %s",
                (usuario_id,)
            )

            cursor.execute(
                """
                DELETE FROM vinculos_agronomo
                WHERE produtor_id = %s
                """,
                (usuario_id,)
            )

        else:
            cursor.execute(
                """
                DELETE FROM vinculos_agronomo
                WHERE agronomo_id = %s
                """,
                (usuario_id,)
            )

        cursor.execute(
            "DELETE FROM usuarios WHERE id = %s",
            (usuario_id,)
        )

        mysql.connection.commit()

        return jsonify({
            "mensagem": "Usuário e dados vinculados excluídos com sucesso"
        }), 200

    except Exception:
        if cursor is not None:
            mysql.connection.rollback()

        current_app.logger.exception("Erro ao excluir usuário")

        return jsonify({
            "mensagem": "Erro ao excluir usuário."
        }), 500

    finally:
        if cursor is not None:
            cursor.close()


# ================================================================
# DASHBOARD
# ================================================================

@cooperativa_bp.route("/cooperativa/dashboard", methods=["GET"])
@requer_tipo("cooperativa")
def dashboard():
    cursor = None

    try:
        cursor = mysql.connection.cursor()

        cursor.execute(
            "SELECT COUNT(*) FROM usuarios WHERE tipo = 'produtor'"
        )
        total_produtores = cursor.fetchone()[0]

        cursor.execute(
            "SELECT COUNT(*) FROM usuarios WHERE tipo = 'agronomo'"
        )
        total_agronomos = cursor.fetchone()[0]

        cursor.execute(
            """
            SELECT COUNT(*)
            FROM usuarios
            WHERE tipo = 'produtor'
              AND id NOT IN (
                  SELECT produtor_id FROM vinculos_agronomo
              )
            """
        )
        produtores_sem_agronomo = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM lavouras")
        total_lavouras = cursor.fetchone()[0]

        cursor.execute(
            "SELECT status, COUNT(*) FROM lavouras GROUP BY status"
        )

        contagem_status = {
            linha[0]: linha[1]
            for linha in cursor.fetchall()
        }

        cursor.execute(
            """
            SELECT
                lavouras.id,
                lavouras.nome_lavoura,
                lavouras.status,
                usuarios.nome
            FROM lavouras
            JOIN usuarios ON usuarios.id = lavouras.usuario_id
            WHERE lavouras.status IN ('atencao', 'critico')
            ORDER BY FIELD(lavouras.status, 'critico', 'atencao')
            """
        )

        lavouras_em_alerta = [
            {
                "id": linha[0],
                "nomeLavoura": linha[1],
                "status": linha[2],
                "produtor": linha[3],
            }
            for linha in cursor.fetchall()
        ]

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

    except Exception:
        current_app.logger.exception("Erro ao montar dashboard")

        return jsonify({
            "mensagem": "Erro ao montar dashboard."
        }), 500

    finally:
        if cursor is not None:
            cursor.close()


# ================================================================
# RANKING DOS AGRÔNOMOS
# ================================================================

@cooperativa_bp.route(
    "/cooperativa/ranking-agronomos",
    methods=["GET"]
)
@requer_tipo("cooperativa")
def ranking_agronomos():
    cursor = None

    try:
        cursor = mysql.connection.cursor()

        cursor.execute(
            """
            SELECT
                usuarios.id,
                usuarios.nome,
                COUNT(DISTINCT vinculos_agronomo.produtor_id),
                COUNT(DISTINCT lavouras.id),
                SUM(
                    CASE
                        WHEN lavouras.status = 'critico' THEN 1
                        ELSE 0
                    END
                )
            FROM usuarios
            LEFT JOIN vinculos_agronomo
                ON vinculos_agronomo.agronomo_id = usuarios.id
            LEFT JOIN lavouras
                ON lavouras.usuario_id = vinculos_agronomo.produtor_id
            WHERE usuarios.tipo = 'agronomo'
            GROUP BY usuarios.id, usuarios.nome
            ORDER BY COUNT(DISTINCT vinculos_agronomo.produtor_id) DESC
            """
        )

        ranking = [
            {
                "id": linha[0],
                "nome": linha[1],
                "totalProdutores": linha[2],
                "totalLavouras": linha[3],
                "lavourasCriticas": linha[4] or 0,
            }
            for linha in cursor.fetchall()
        ]

        return jsonify(ranking), 200

    except Exception:
        current_app.logger.exception("Erro ao montar ranking")

        return jsonify({
            "mensagem": "Erro ao montar ranking."
        }), 500

    finally:
        if cursor is not None:
            cursor.close()


# ================================================================
# RELATÓRIO CSV
# ================================================================

@cooperativa_bp.route(
    "/cooperativa/relatorio.csv",
    methods=["GET"]
)
@requer_tipo("cooperativa")
def relatorio_csv():
    cursor = None

    try:
        cursor = mysql.connection.cursor()

        cursor.execute(
            """
            SELECT
                usuarios.nome,
                agronomo.nome,
                lavouras.nome_lavoura,
                lavouras.status,
                lavouras.criado_em
            FROM lavouras
            JOIN usuarios ON usuarios.id = lavouras.usuario_id
            LEFT JOIN vinculos_agronomo
                ON vinculos_agronomo.produtor_id = usuarios.id
            LEFT JOIN usuarios AS agronomo
                ON agronomo.id = vinculos_agronomo.agronomo_id
            ORDER BY usuarios.nome
            """
        )

        buffer = io.StringIO()
        escritor = csv.writer(buffer)

        escritor.writerow([
            "Produtor",
            "Agrônomo",
            "Lavoura",
            "Status",
            "Cadastrada em",
        ])

        for linha in cursor.fetchall():
            escritor.writerow([
                linha[0],
                linha[1] or "Sem agrônomo",
                linha[2],
                linha[3],
                linha[4],
            ])

        return Response(
            buffer.getvalue(),
            mimetype="text/csv",
            headers={
                "Content-Disposition":
                    "attachment; filename=relatorio_coffeevision.csv"
            }
        )

    except Exception:
        current_app.logger.exception("Erro ao gerar relatório")

        return jsonify({
            "mensagem": "Erro ao gerar relatório."
        }), 500

    finally:
        if cursor is not None:
            cursor.close()


# ================================================================
# CRIAR AVISO
# ================================================================

@cooperativa_bp.route("/cooperativa/avisos", methods=["POST"])
@requer_tipo("cooperativa")
def criar_aviso():
    dados = request.get_json(silent=True)

    if not isinstance(dados, dict):
        return jsonify({"mensagem": "Dados inválidos."}), 400

    titulo = dados.get("titulo")
    mensagem = dados.get("mensagem")
    destinatario_tipo = dados.get("destinatarioTipo", "todos")
    cooperativa_id = request.headers.get("X-Usuario-Id", type=int)

    if (
        not isinstance(titulo, str)
        or not titulo.strip()
        or not isinstance(mensagem, str)
        or not mensagem.strip()
    ):
        return jsonify({
            "mensagem": "Título e mensagem são obrigatórios."
        }), 400

    if destinatario_tipo not in ("todos", "produtores", "agronomos"):
        return jsonify({
            "mensagem": "Destinatário inválido."
        }), 400

    titulo = titulo.strip()
    mensagem = mensagem.strip()
    cursor = None

    try:
        cursor = mysql.connection.cursor()

        # Todo aviso novo começa como não lido.
        cursor.execute(
            """
            INSERT INTO avisos (
                cooperativa_id,
                titulo,
                mensagem,
                destinatario_tipo,
                lido
            )
            VALUES (%s, %s, %s, %s, 0)
            """,
            (cooperativa_id, titulo, mensagem, destinatario_tipo)
        )

        aviso_id = cursor.lastrowid

        if destinatario_tipo == "todos":
            cursor.execute(
                """
                SELECT email FROM usuarios
                WHERE tipo IN ('produtor', 'agronomo')
                """
            )
        elif destinatario_tipo == "produtores":
            cursor.execute(
                "SELECT email FROM usuarios WHERE tipo = 'produtor'"
            )
        else:
            cursor.execute(
                "SELECT email FROM usuarios WHERE tipo = 'agronomo'"
            )

        emails = [linha[0] for linha in cursor.fetchall()]
        mysql.connection.commit()

    except Exception:
        if cursor is not None:
            mysql.connection.rollback()

        current_app.logger.exception("Erro ao criar aviso")

        return jsonify({
            "mensagem": "Erro ao criar aviso."
        }), 500

    finally:
        if cursor is not None:
            cursor.close()

    # O aviso já está salvo. Falhas de e-mail não desfazem a criação.
    enviados = 0
    falhas = 0

    try:
        html, texto = montar_email_aviso(titulo, mensagem)

        for email in emails:
            try:
                enviar_email(
                    email,
                    f"CoffeeVision — {titulo}",
                    html,
                    texto
                )
                enviados += 1
            except Exception:
                falhas += 1
                current_app.logger.exception(
                    "Falha ao enviar e-mail do aviso %s",
                    aviso_id
                )

    except Exception:
        falhas = len(emails)
        current_app.logger.exception(
            "Falha ao preparar e-mail do aviso %s",
            aviso_id
        )

    resposta = {
        "mensagem": "Aviso criado com sucesso.",
        "id": aviso_id,
        "emailsEnviados": enviados,
    }

    if falhas:
        resposta["emailsComFalha"] = falhas

    return jsonify(resposta), 201


# ================================================================
# IDENTIFICAÇÃO PARA CONSULTA E LEITURA DE AVISOS
# ================================================================

def _contexto_avisos(cursor):
    # Compatibilidade com o login atual.
    # Este cabeçalho não substitui uma sessão/token autenticado.
    usuario_id = request.headers.get("X-Usuario-Id", type=int)

    if not usuario_id or usuario_id <= 0:
        return None

    cursor.execute(
        "SELECT tipo FROM usuarios WHERE id = %s",
        (usuario_id,)
    )

    usuario = cursor.fetchone()

    if not usuario:
        return None

    destino = {
        "produtor": "produtores",
        "agronomo": "agronomos",
    }.get(usuario[0])

    if destino is None:
        return None

    return usuario_id, destino


# ================================================================
# LISTAR AVISOS — LEITURA COMPARTILHADA
# ================================================================

@cooperativa_bp.route("/avisos", methods=["GET"])
def listar_avisos():
    cursor = None

    try:
        cursor = mysql.connection.cursor()
        contexto = _contexto_avisos(cursor)

        if contexto is None:
            return jsonify({
                "mensagem": "Usuário inválido para receber avisos."
            }), 401

        usuario_id, destino = contexto

        cursor.execute(
            """
            SELECT
                id,
                titulo,
                mensagem,
                destinatario_tipo,
                criado_em,
                COALESCE(lido, 0)
            FROM avisos
            WHERE destinatario_tipo IN ('todos', %s)
            ORDER BY criado_em DESC, id DESC
            """,
            (destino,)
        )

        avisos = [
            {
                "id": linha[0],
                "titulo": linha[1],
                "mensagem": linha[2],
                "destinatarioTipo": linha[3],
                "criadoEm": (
                    linha[4].isoformat() if linha[4] else None
                ),
                "lido": bool(linha[5]),
            }
            for linha in cursor.fetchall()
        ]

        resposta = jsonify(avisos)
        resposta.headers["Cache-Control"] = "no-store"

        return resposta, 200

    except Exception:
        current_app.logger.exception("Erro ao listar avisos")

        return jsonify({
            "mensagem": "Não foi possível carregar os avisos."
        }), 500

    finally:
        if cursor is not None:
            cursor.close()


# ================================================================
# MARCAR UM AVISO COMO LIDO
# ================================================================

@cooperativa_bp.route(
    "/avisos/<int:aviso_id>/ler",
    methods=["POST"]
)
def marcar_aviso_lido(aviso_id):
    cursor = None

    try:
        cursor = mysql.connection.cursor()
        contexto = _contexto_avisos(cursor)

        if contexto is None:
            return jsonify({
                "mensagem": "Usuário inválido para receber avisos."
            }), 401

        usuario_id, destino = contexto

        cursor.execute(
            """
            SELECT id
            FROM avisos
            WHERE id = %s
              AND destinatario_tipo IN ('todos', %s)
            """,
            (aviso_id, destino)
        )

        if cursor.fetchone() is None:
            return jsonify({
                "mensagem": "Aviso não encontrado."
            }), 404

        cursor.execute(
            """
            UPDATE avisos
            SET lido = 1
            WHERE id = %s
              AND destinatario_tipo IN ('todos', %s)
            """,
            (aviso_id, destino)
        )

        mysql.connection.commit()

        return jsonify({
            "mensagem": "Leitura salva.",
            "id": aviso_id,
            "lido": True,
        }), 200

    except Exception:
        if cursor is not None:
            mysql.connection.rollback()

        current_app.logger.exception(
            "Erro ao marcar aviso como lido"
        )

        return jsonify({
            "mensagem": "Não foi possível salvar a leitura."
        }), 500

    finally:
        if cursor is not None:
            cursor.close()


# ================================================================
# MARCAR AVISOS CARREGADOS COMO LIDOS
# ================================================================

@cooperativa_bp.route("/avisos/ler-todos", methods=["POST"])
def marcar_todos_avisos_lidos():
    dados = request.get_json(silent=True)
    ids = dados.get("ids") if isinstance(dados, dict) else None

    if (
        not isinstance(ids, list)
        or len(ids) > 1000
        or any(type(i) is not int or i <= 0 for i in ids)
    ):
        return jsonify({
            "mensagem": "Informe até 1000 IDs válidos."
        }), 400

    cursor = None

    try:
        cursor = mysql.connection.cursor()
        contexto = _contexto_avisos(cursor)

        if contexto is None:
            return jsonify({
                "mensagem": "Usuário inválido para receber avisos."
            }), 401

        usuario_id, destino = contexto

        for aviso_id in set(ids):
            cursor.execute(
                """
                UPDATE avisos
                SET lido = 1
                WHERE id = %s
                  AND destinatario_tipo IN ('todos', %s)
                """,
                (aviso_id, destino)
            )

        mysql.connection.commit()

        return jsonify({
            "mensagem": "Leituras salvas."
        }), 200

    except Exception:
        if cursor is not None:
            mysql.connection.rollback()

        current_app.logger.exception(
            "Erro ao marcar todos os avisos como lidos"
        )

        return jsonify({
            "mensagem": "Não foi possível salvar as leituras."
        }), 500

    finally:
        if cursor is not None:
            cursor.close()


# ================================================================
# ALTERAÇÃO DE SENHA
# ================================================================

@cooperativa_bp.route(
    "/usuario/<int:usuario_id>/senha",
    methods=["PUT"]
)
@requer_tipo("produtor", "agronomo", "cooperativa")
def senha_edit(usuario_id):
    dados = request.get_json(silent=True)

    if not isinstance(dados, dict):
        return jsonify({"mensagem": "Dados inválidos."}), 400

    nova_senha = dados.get("senha")

    if not isinstance(nova_senha, str) or len(nova_senha) < 6:
        return jsonify({
            "mensagem": "A senha deve ter pelo menos 6 caracteres."
        }), 400

    solicitante_id = request.headers.get("X-Usuario-Id", type=int)
    cursor = None

    try:
        cursor = mysql.connection.cursor()

        cursor.execute(
            "SELECT tipo FROM usuarios WHERE id = %s",
            (solicitante_id,)
        )
        solicitante = cursor.fetchone()

        if not solicitante:
            return jsonify({"mensagem": "Usuário inválido."}), 401

        # Usuário altera a própria senha.
        # Cooperativa também pode alterar a senha de outros usuários.
        if (
            solicitante_id != usuario_id
            and solicitante[0] != "cooperativa"
        ):
            return jsonify({
                "mensagem": "Você não pode alterar a senha deste usuário."
            }), 403

        cursor.execute(
            "SELECT id FROM usuarios WHERE id = %s",
            (usuario_id,)
        )

        if cursor.fetchone() is None:
            return jsonify({
                "mensagem": "Usuário não encontrado."
            }), 404

        senha_hash = bcrypt.hashpw(
            nova_senha.encode("utf-8"),
            bcrypt.gensalt()
        ).decode("utf-8")

        cursor.execute(
            """
            UPDATE usuarios
            SET senha_hash = %s,
                confirma_senha_hash = %s
            WHERE id = %s
            """,
            (senha_hash, senha_hash, usuario_id)
        )

        mysql.connection.commit()

        return jsonify({
            "mensagem": "Senha alterada com sucesso."
        }), 200

    except Exception:
        if cursor is not None:
            mysql.connection.rollback()

        current_app.logger.exception("Erro ao alterar senha")

        return jsonify({
            "mensagem": "Não foi possível alterar a senha."
        }), 500

    finally:
        if cursor is not None:
            cursor.close()


# ================================================================
# DESVINCULAR PRODUTOR DO AGRÔNOMO
# ================================================================

@cooperativa_bp.route("/desvincular", methods=["POST"])
@requer_tipo("cooperativa")
def desvincular():
    dados = request.get_json(silent=True)

    if not isinstance(dados, dict):
        return jsonify({"mensagem": "Dados inválidos."}), 400

    produtor_id = dados.get("produtorId")

    if not produtor_id:
        return jsonify({
            "mensagem": "Produtor é obrigatório."
        }), 400

    cursor = None

    try:
        cursor = mysql.connection.cursor()

        cursor.execute(
            """
            SELECT id
            FROM vinculos_agronomo
            WHERE produtor_id = %s
            """,
            (produtor_id,)
        )

        if cursor.fetchone() is None:
            return jsonify({
                "mensagem": "Vínculo não encontrado."
            }), 404

        cursor.execute(
            """
            DELETE FROM vinculos_agronomo
            WHERE produtor_id = %s
            """,
            (produtor_id,)
        )

        mysql.connection.commit()

        return jsonify({
            "mensagem": "Produtor desvinculado com sucesso."
        }), 200

    except Exception:
        if cursor is not None:
            mysql.connection.rollback()

        current_app.logger.exception("Erro ao desvincular produtor")

        return jsonify({
            "mensagem": "Erro ao desvincular produtor."
        }), 500

    finally:
        if cursor is not None:
            cursor.close()