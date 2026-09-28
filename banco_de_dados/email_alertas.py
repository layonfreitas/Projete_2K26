import hashlib
import json
import logging
import os
from urllib.parse import urlsplit
from collections import defaultdict
from contextlib import closing
from html import escape
from email_utils import enviar_email, _moldura_html

log = logging.getLogger(__name__)


def notificar_alertas(conexao, lista):
    """Recebe as tuplas validadas de insert_alerta, após salvar os alertas."""
    frontend_url = os.getenv("FRONTEND_URL", "").strip().rstrip("/")
    endereco = urlsplit(frontend_url)

    if (
        endereco.scheme not in ("https", "http")
        or not endereco.netloc
        or endereco.query
        or endereco.fragment
    ):
        raise RuntimeError(
            "Configure FRONTEND_URL com o endereço do aplicativo."
        )
    grupos = defaultdict(set)
    resumo = {"enviados": 0, "repetidos": 0, "falhas": 0}

    for _, lavoura_id, critico, indice, data_imagem, contorno in lista:
        if not critico:
            continue

        if not data_imagem:
            log.warning(
                "Alerta crítico sem data: lavoura %s",
                lavoura_id,
            )
            resumo["falhas"] += 1
            continue

        grupos[(int(lavoura_id), str(data_imagem))].add(
            (indice, str(contorno or ""))
        )

    for (lavoura_id, data_imagem), eventos in grupos.items():
        # Busca o proprietário real e o agrônomo vinculado no banco.
        # Não utiliza destinatários informados no JSON da requisição.
        with closing(conexao.cursor()) as cursor:
            cursor.execute(
                """
                SELECT
                    l.nome_lavoura,
                    p.id,
                    p.nome,
                    p.email,
                    a.id,
                    a.nome,
                    a.email
                FROM lavouras l
                JOIN usuarios p
                    ON p.id = l.usuario_id
                LEFT JOIN vinculos_agronomo v
                    ON v.produtor_id = p.id
                LEFT JOIN usuarios a
                    ON a.id = v.agronomo_id
                    AND a.tipo = 'agronomo'
                WHERE l.id = %s
                """,
                (lavoura_id,),
            )
            linha = cursor.fetchone()

        conexao.commit()

        if not linha:
            resumo["falhas"] += 1
            continue

        (
            lavoura,
            pid,
            produtor,
            pemail,
            aid,
            agronomo,
            aemail,
        ) = linha

        destinatarios = {}

        for uid, nome, email in (
            (pid, produtor, pemail),
            (aid, agronomo, aemail),
        ):
            if uid and email and email.strip():
                destinatarios.setdefault(
                    email.strip().lower(),
                    (uid, nome),
                )

        if not aemail:
            log.warning(
                "Lavoura %s: sem agrônomo vinculado com e-mail.",
                lavoura_id,
            )

        if not destinatarios:
            resumo["falhas"] += 1

        indices = ", ".join(
            sorted({indice for indice, _ in eventos})
        )

        for email, (uid, nome) in destinatarios.items():
            # Identifica a mesma análise para o mesmo destinatário.
            identidade = [
                lavoura_id,
                data_imagem,
                sorted(eventos),
                email,
            ]

            chave = hashlib.sha256(
                json.dumps(
                    identidade,
                    ensure_ascii=False,
                ).encode("utf-8")
            ).hexdigest()

            try:
                with closing(conexao.cursor()) as cursor:
                    cursor.execute(
                        """
                        INSERT IGNORE INTO emails_alertas
                            (chave, lavoura_id, usuario_id)
                        VALUES (%s, %s, %s)
                        """,
                        (chave, lavoura_id, uid),
                    )

                    # Bloqueia este registro durante o envio para
                    # evitar duas requisições enviando simultaneamente.
                    cursor.execute(
                        """
                        SELECT enviado_em
                        FROM emails_alertas
                        WHERE chave = %s
                        FOR UPDATE
                        """,
                        (chave,),
                    )

                    if cursor.fetchone()[0] is not None:
                        conexao.commit()
                        resumo["repetidos"] += 1
                        continue

                    texto = (
                        f"Olá, {nome}!\n\n"
                        f"Identificamos um alerta crítico "
                        f"na lavoura {lavoura}.\n"
                        f"Produtor: {produtor}\n"
                        f"Data da imagem analisada: {data_imagem}\n"
                        f"Indicadores: {indices}\n\n"
                        "Acesse o CoffeeVision e consulte os mapas "
                        "e alertas dessa lavoura. Recomendamos uma "
                        "avaliação do agrônomo.\n\n"
                        "Este aviso automático indica uma anomalia "
                        "nos dados; não confirma doença ou perda "
                        "de produção."
                    )

                    link_lavoura = (
                        f"{frontend_url}/login?lavouraId={lavoura_id}"
                    )
                    link_html = escape(link_lavoura, quote=True)

                    corpo_html = (
                        '<p style="line-height:1.6;color:#3A2A1A">'
                        + escape(texto).replace("\n", "<br>")
                        + "</p>"
                        + f"""
                        <table role="presentation" cellpadding="0"
                               cellspacing="0" style="margin:24px 0;">
                          <tr>
                            <td style="background:#166534;
                                       border-radius:8px;
                                       text-align:center;">
                              <a href="{link_html}"
                                 style="display:inline-block;
                                        padding:15px 24px;
                                        color:#ffffff;
                                        font-size:16px;
                                        font-weight:bold;
                                        text-decoration:none;">
                                Abrir lavoura no mapa
                              </a>
                            </td>
                          </tr>
                        </table>

                        <p style="font-size:13px;
                                  line-height:1.6;
                                  color:#6b7280;">
                          Se necessário, entre na sua conta para
                          acessar a lavoura.
                        </p>

                        <p style="font-size:12px;
                                  line-height:1.6;
                                  word-break:break-all;">
                          Se o botão não funcionar, acesse:<br>
                          <a href="{link_html}">{link_html}</a>
                        </p>
                        """
                    )

                    html = _moldura_html(
                        "Sua lavoura precisa de atenção",
                        corpo_html,
                    )

                    # Inclui o endereço na versão sem formatação.
                    texto += (
                        f"\n\nAbrir lavoura no mapa: {link_lavoura}"
                    )  

                    enviar_email(
                        email,
                        "CoffeeVision — Alerta crítico na lavoura",
                        html,
                        texto,
                    )

                    cursor.execute(
                        """
                        UPDATE emails_alertas
                        SET enviado_em = UTC_TIMESTAMP()
                        WHERE chave = %s
                        """,
                        (chave,),
                    )

                conexao.commit()
                resumo["enviados"] += 1

            except Exception:
                conexao.rollback()
                resumo["falhas"] += 1

                log.exception(
                    "Falha no e-mail: lavoura=%s, usuario=%s",
                    lavoura_id,
                    uid,
                )

    return resumo