from flask import Blueprint, request, jsonify, current_app
import random
import string
import smtplib
from email.mime.text import MIMEText
from datetime import datetime, timedelta
import bcrypt

senha_bp = Blueprint('senha', __name__)
mysql = None

def init_mysql(mysql_instance):
    global mysql
    mysql = mysql_instance


def gerar_codigo():
    return ''.join(random.choices(string.digits, k=6))


def enviar_email_codigo(destinatario, codigo):
    corpo = (
        f"Seu código de recuperação de senha do CoffeeVision é: {codigo}\n\n"
        f"Esse código expira em 15 minutos. Se você não solicitou essa troca, "
        f"ignore este e-mail."
    )

    msg = MIMEText(corpo)
    msg['Subject'] = 'CoffeeVision - Código de recuperação de senha'
    msg['From'] = current_app.config['EMAIL_USER']
    msg['To'] = destinatario

    with smtplib.SMTP(current_app.config['EMAIL_HOST'], current_app.config['EMAIL_PORT']) as servidor:
        servidor.starttls()
        servidor.login(current_app.config['EMAIL_USER'], current_app.config['EMAIL_SENHA'])
        servidor.send_message(msg)


@senha_bp.route('/senha/recuperar/solicitar', methods=['POST'])
def solicitar_codigo():
    dados = request.get_json()
    email = dados.get('email')

    if not email:
        return jsonify({"mensagem": "Informe o e-mail"}), 400

    try:
        cursor = mysql.connection.cursor()
        cursor.execute("SELECT id FROM usuarios WHERE email = %s", (email,))
        resultado = cursor.fetchone()

        # Por segurança, sempre respondemos "enviado" mesmo se o e-mail
        # não existir no banco, pra não revelar quais e-mails estão cadastrados.
        if resultado:
            codigo = gerar_codigo()
            expira_em = datetime.now() + timedelta(minutes=15)

            cursor.execute(
                "UPDATE usuarios SET codigo_recuperacao = %s, codigo_expira_em = %s WHERE id = %s",
                (codigo, expira_em, resultado[0])
            )
            mysql.connection.commit()

            enviar_email_codigo(email, codigo)

        cursor.close()
        return jsonify({"mensagem": "Se o e-mail existir, um código foi enviado."}), 200
    except Exception as erro:
        return jsonify({"mensagem": "Erro ao solicitar código", "erro": str(erro)}), 500


@senha_bp.route('/senha/recuperar/confirmar', methods=['POST'])
def confirmar_codigo():
    dados = request.get_json()
    email = dados.get('email')
    codigo = dados.get('codigo')
    nova_senha = dados.get('novaSenha')

    if not email or not codigo or not nova_senha:
        return jsonify({"mensagem": "Todos os campos são obrigatórios"}), 400

    try:
        cursor = mysql.connection.cursor()
        cursor.execute(
            "SELECT id, codigo_recuperacao, codigo_expira_em FROM usuarios WHERE email = %s",
            (email,)
        )
        resultado = cursor.fetchone()

        if not resultado or resultado[1] != codigo:
            cursor.close()
            return jsonify({"mensagem": "Código inválido"}), 400

        if resultado[2] is None or datetime.now() > resultado[2]:
            cursor.close()
            return jsonify({"mensagem": "Código expirado. Solicite um novo."}), 400

        nova_senha_hash = bcrypt.hashpw(nova_senha.encode('utf-8'), bcrypt.gensalt())

        cursor.execute(
            "UPDATE usuarios SET senha_hash = %s, codigo_recuperacao = NULL, codigo_expira_em = NULL WHERE id = %s",
            (nova_senha_hash, resultado[0])
        )
        mysql.connection.commit()
        cursor.close()

        return jsonify({"mensagem": "Senha redefinida com sucesso"}), 200
    except Exception as erro:
        return jsonify({"mensagem": "Erro ao redefinir senha", "erro": str(erro)}), 500


@senha_bp.route('/senha/trocar', methods=['POST'])
def trocar_senha():
    dados = request.get_json()
    usuario_id = dados.get('usuarioId')
    senha_atual = dados.get('senhaAtual')
    nova_senha = dados.get('novaSenha')

    if not usuario_id or not senha_atual or not nova_senha:
        return jsonify({"mensagem": "Todos os campos são obrigatórios"}), 400

    try:
        cursor = mysql.connection.cursor()
        cursor.execute("SELECT senha_hash FROM usuarios WHERE id = %s", (usuario_id,))
        resultado = cursor.fetchone()

        if not resultado:
            cursor.close()
            return jsonify({"mensagem": "Usuário não encontrado"}), 404

        senha_hash_salva = resultado[0]
        if isinstance(senha_hash_salva, str):
            senha_hash_salva = senha_hash_salva.encode('utf-8')

        if not bcrypt.checkpw(senha_atual.encode('utf-8'), senha_hash_salva):
            cursor.close()
            return jsonify({"mensagem": "Senha atual incorreta"}), 401

        nova_senha_hash = bcrypt.hashpw(nova_senha.encode('utf-8'), bcrypt.gensalt())
        cursor.execute(
            "UPDATE usuarios SET senha_hash = %s WHERE id = %s",
            (nova_senha_hash, usuario_id)
        )
        mysql.connection.commit()
        cursor.close()

        return jsonify({"mensagem": "Senha alterada com sucesso"}), 200
    except Exception as erro:
        return jsonify({"mensagem": "Erro ao trocar senha", "erro": str(erro)}), 500