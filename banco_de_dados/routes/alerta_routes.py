from flask import Blueprint, jsonify, request
from flask_mail import Message
from app import mysql, mail

avisos_bp = Blueprint('avisos', __name__)


def _enviar_email_aviso(usuario_id, titulo, mensagem, severidade):
    cursor = mysql.connection.cursor()
    cursor.execute("SELECT email, nome FROM usuarios WHERE id = %s", (usuario_id,))
    usuario = cursor.fetchone()
    cursor.close()

    if not usuario:
        return False

    email_destino, nome = usuario[0], usuario[1]

    try:
        msg = Message(
            subject=f"[Aviso {severidade.upper()}] {titulo}",
            recipients=[email_destino],
            body=f"Olá, {nome}.\n\n{mensagem}\n\nAcesse o sistema para mais detalhes."
        )
        mail.send(msg)
        return True
    except Exception as e:
        print(f"erro ao enviar email: {e}")
        return False


def AVISO_DOENCA(usuario_id, lavoura_id, titulo, mensagem, severidade='media', tipo='doenca_detectada'):
    cursor = mysql.connection.cursor()
    cursor.execute(
        """INSERT INTO avisos (usuario_id, lavoura_id, titulo, mensagem, severidade, tipo)
        VALUES (%s, %s, %s, %s, %s, %s)""",
        (usuario_id, lavoura_id, titulo, mensagem, severidade, tipo)
    )
    mysql.connection.commit()
    aviso_id = cursor.lastrowid

    email_ok = _enviar_email_aviso(usuario_id, titulo, mensagem, severidade)

    if email_ok:
        cursor.execute("UPDATE avisos SET email_enviado = TRUE WHERE id = %s", (aviso_id,))
        mysql.connection.commit()

    cursor.close()
    return aviso_id


@avisos_bp.route('/avisos', methods=['GET'])
def listar_avisos():
    usuario_id = request.args.get('usuario_id')  # ou pegue da sessão/token, conforme o login de vocês
    apenas_nao_lidos = request.args.get('lido') == 'false'

    cursor = mysql.connection.cursor()
    query = "SELECT * FROM avisos WHERE usuario_id = %s"
    params = [usuario_id]

    if apenas_nao_lidos:
        query += " AND lido = FALSE"

    query += " ORDER BY criado_em DESC"
    cursor.execute(query, params)
    colunas = [desc[0] for desc in cursor.description]
    avisos = [dict(zip(colunas, linha)) for linha in cursor.fetchall()]
    cursor.close()

    return jsonify(avisos)


@avisos_bp.route('/avisos/<int:aviso_id>/marcar-lido', methods=['PUT'])
def marcar_lido(aviso_id):
    cursor = mysql.connection.cursor()
    cursor.execute("UPDATE avisos SET lido = TRUE WHERE id = %s", (aviso_id,))
    mysql.connection.commit()
    cursor.close()
    return jsonify({'sucesso': True})