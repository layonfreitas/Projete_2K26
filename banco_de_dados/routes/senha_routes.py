from flask import Blueprint, request, jsonify, current_app
import random
import string
import smtplib
from email.mime.text import MIMEText
from datetime import datetime, timedelta
import bcrypt
import requests

senha_bp = Blueprint('senha', __name__)
mysql = None

def init_mysql(mysql_instance):
    global mysql
    mysql = mysql_instance


def gerar_codigo():
    return ''.join(random.choices(string.digits, k=6))




def montar_html_codigo(codigo):
    return f"""\
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#F3ECE3; font-family: 'Segoe UI', Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F3ECE3; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%; background-color:#FFFFFF; border-radius:16px; overflow:hidden; box-shadow:0 4px 18px rgba(93,64,42,0.12);">

          <!-- Cabeçalho -->
          <tr>
            <td style="background-color:#4B3621; padding:28px 32px; text-align:center;">
              <span style="font-size:26px; line-height:1;">☕</span>
              <span style="display:block; margin-top:6px; font-size:20px; font-weight:700; color:#F3ECE3; letter-spacing:0.5px;">
                CoffeeVision
              </span>
            </td>
          </tr>

          <!-- Corpo -->
          <tr>
            <td style="padding:36px 32px 12px 32px;">
              <h1 style="margin:0 0 12px 0; font-size:19px; color:#3A2A1A;">
                Recuperação de senha
              </h1>
              <p style="margin:0 0 24px 0; font-size:15px; line-height:1.6; color:#5C4A3A;">
                Recebemos uma solicitação para redefinir a senha da sua conta no CoffeeVision.
                Use o código abaixo para continuar:
              </p>
            </td>
          </tr>

          <!-- Código -->
          <tr>
            <td style="padding:0 32px 28px 32px;" align="center">
              <div style="background-color:#FBF3E9; border:1px dashed #C8A27A; border-radius:12px; padding:18px 24px; display:inline-block;">
                <span style="font-size:32px; font-weight:700; letter-spacing:10px; color:#4B3621; font-family: 'Courier New', monospace;">
                  {codigo}
                </span>
              </div>
            </td>
          </tr>

          <!-- Aviso -->
          <tr>
            <td style="padding:0 32px 32px 32px;">
              <p style="margin:0; font-size:13px; line-height:1.6; color:#8A7A6A;">
                Esse código expira em <strong>15 minutos</strong>. Se você não solicitou essa troca,
                pode ignorar este e-mail com tranquilidade — sua senha continua a mesma.
              </p>
            </td>
          </tr>

          <!-- Rodapé -->
          <tr>
            <td style="background-color:#F3ECE3; padding:18px 32px; text-align:center;">
              <p style="margin:0; font-size:12px; color:#A6957F;">
                🌿 CoffeeVision — cuidando das suas lavouras de café
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


def enviar_email_codigo(destinatario, codigo):
    resposta = requests.post(
        "https://api.brevo.com/v3/smtp/email",
        headers={
            "api-key": current_app.config['BREVO_API_KEY'],
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        json={
            "sender": {"email": current_app.config['BREVO_EMAIL_REMETENTE'], "name": "CoffeeVision"},
            "to": [{"email": destinatario}],
            "subject": "CoffeeVision - Código de recuperação de senha",
            "htmlContent": montar_html_codigo(codigo),
            "textContent": (
                f"Seu código de recuperação de senha do CoffeeVision é: {codigo}\n\n"
                f"Esse código expira em 15 minutos. Se você não solicitou essa troca, ignore este e-mail."
            ),
        },
    )

    if resposta.status_code >= 300:
        raise Exception(f"Erro ao enviar e-mail: {resposta.text}")

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

        if not resultado:
            cursor.close()
            return jsonify({"mensagem": "Não existe nenhuma conta cadastrada com esse e-mail."}), 404

        codigo = gerar_codigo()
        expira_em = datetime.now() + timedelta(minutes=15)

        cursor.execute(
            "UPDATE usuarios SET codigo_recuperacao = %s, codigo_expira_em = %s WHERE id = %s",
            (codigo, expira_em, resultado[0])
        )
        mysql.connection.commit()
        cursor.close()

        enviar_email_codigo(email, codigo)

        return jsonify({"mensagem": "Código enviado para o seu e-mail."}), 200
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