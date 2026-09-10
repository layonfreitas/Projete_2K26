

import requests
from flask import current_app


def enviar_email(destinatario, assunto, html, texto, anexos=None):

    payload = {
        "sender": {"email": current_app.config['BREVO_EMAIL_REMETENTE'], "name": "CoffeeVision"},
        "to": [{"email": destinatario}],
        "subject": assunto,
        "htmlContent": html,
        "textContent": texto,
    }

    if anexos:
        payload["attachment"] = anexos

    resposta = requests.post(
        "https://api.brevo.com/v3/smtp/email",
        headers={
            "api-key": current_app.config['BREVO_API_KEY'],
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        json=payload,
    )

    if resposta.status_code >= 300:
        raise Exception(f"Erro ao enviar e-mail: {resposta.text}")


def _moldura_html(titulo, corpo_html):

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
          <tr>
            <td style="background-color:#4B3621; padding:28px 32px; text-align:center;">
              <span style="font-size:26px; line-height:1;">☕</span>
              <span style="display:block; margin-top:6px; font-size:20px; font-weight:700; color:#F3ECE3; letter-spacing:0.5px;">
                CoffeeVision
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 32px 40px 32px;">
              <h1 style="margin:0 0 12px 0; font-size:19px; color:#3A2A1A;">{titulo}</h1>
              {corpo_html}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


def montar_email_aviso(titulo_aviso, mensagem_aviso):
    html = _moldura_html(
        titulo_aviso,
        f'<p style="margin:0; font-size:15px; line-height:1.6; color:#5C4A3A; white-space:pre-line;">{mensagem_aviso}</p>'
        '<p style="margin:24px 0 0 0; font-size:12.5px; color:#8A7A6A;">Este é um comunicado da sua cooperativa no CoffeeVision.</p>'
    )
    texto = f"{titulo_aviso}\n\n{mensagem_aviso}\n\n— Comunicado da sua cooperativa no CoffeeVision."
    return html, texto


def montar_email_observacao(nome_agronomo, nome_lavoura, texto_observacao):
    html = _moldura_html(
        "Nova observação na sua lavoura",
        f'<p style="margin:0 0 16px 0; font-size:15px; line-height:1.6; color:#5C4A3A;">'
        f'O agrônomo <strong>{nome_agronomo}</strong> registrou uma observação na lavoura '
        f'<strong>{nome_lavoura}</strong>:</p>'
        f'<p style="margin:0; padding:14px 16px; background:#F3ECE3; border-radius:10px; '
        f'font-size:14px; line-height:1.6; color:#3A2A1A; white-space:pre-line;">{texto_observacao}</p>'
    )
    texto = (
        f"O agrônomo {nome_agronomo} registrou uma observação na lavoura {nome_lavoura}:\n\n"
        f"{texto_observacao}"
    )
    return html, texto


def montar_email_laudo(nome_produtor, nome_lavoura, nome_remetente):
    """E-mail que acompanha o laudo técnico em PDF anexado."""
    html = _moldura_html(
        "Laudo técnico da sua lavoura",
        f'<p style="margin:0 0 16px 0; font-size:15px; line-height:1.6; color:#5C4A3A;">'
        f'Olá, {nome_produtor}! Segue em anexo o laudo técnico da lavoura '
        f'<strong>{nome_lavoura}</strong>, gerado por {nome_remetente} no CoffeeVision.</p>'
        f'<p style="margin:0; font-size:14px; line-height:1.6; color:#5C4A3A;">'
        f'Abra o arquivo PDF anexado a este e-mail para ver os indicadores, '
        f'observações e recomendações técnicas registradas na análise.</p>'
    )
    texto = (
        f"Olá, {nome_produtor}!\n\n"
        f"Segue em anexo o laudo técnico da lavoura {nome_lavoura}, "
        f"gerado por {nome_remetente} no CoffeeVision.\n\n"
        f"Abra o arquivo PDF anexado para ver os indicadores, observações "
        f"e recomendações técnicas registradas na análise."
    )
    return html, texto