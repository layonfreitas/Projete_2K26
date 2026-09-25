from flask import Blueprint, request, jsonify, current_app
import json
import math
from email_utils import enviar_email, montar_email_laudo
import os
import requests
from datetime import date

lavoura_bp = Blueprint('lavoura', __name__)

mysql = None

def solicitar_mapas(lavoura_id, usuario_id, coordenadas, safras=None):
    base_url = os.getenv("INDICES_API_URL", "").rstrip("/")
    token = os.getenv("MAPAS_INTERNAL_TOKEN", "")

    if not base_url or not token:
        return {
            "status": "nao_configurado",
            "mensagem": "A geração de imagens não foi configurada.",
        }

    try:
        resposta = requests.post(
            f"{base_url}/agendar_mapas/",
            headers={
                "X-Mapas-Token": token,
            },
            json={
                "lavoura_id": lavoura_id,
                "usuario_id": int(usuario_id),
                "coordenadas": coordenadas,
                "safras": safras or [],
            },
            timeout=(5, 10),
        )

        if resposta.status_code == 202:
            return {
                "status": "aceito",
                "mensagem": (
                    "Geração solicitada. "
                    "Aguarde e atualize o histórico."
                ),
            }

        if resposta.status_code == 409:
            return {
                "status": "ocupado",
                "mensagem": (
                    "O serviço está ocupado. "
                    "Tente novamente pelo botão Gerar imagens "
                    "no histórico."
                ),
            }

        current_app.logger.warning(
            "Solicitação de mapas recusada: HTTP %s",
            resposta.status_code,
        )

    except requests.RequestException:
        current_app.logger.exception(
            "Não foi possível confirmar a geração de mapas."
        )

    return {
        "status": "nao_confirmado",
        "mensagem": (
            "Não foi possível confirmar a geração. "
            "Consulte o histórico antes de tentar novamente."
        ),
    }


def _dono_da_lavoura(cursor, lavoura_id):
    """Retorna o usuario_id dono da lavoura, ou None se ela não existir."""
    cursor.execute(
        "SELECT usuario_id FROM lavouras WHERE id = %s",
        (lavoura_id,)
    )
    linha = cursor.fetchone()
    return linha[0] if linha else None


def _exige_dono(lavoura_id):
    """Confere se quem está chamando (X-Usuario-Id) é o dono da lavoura.

    Retorna (ok: bool, resposta_erro: (dict, status) | None).
    Se a lavoura não existir, retorna erro 404 aqui mesmo, para as rotas
    não precisarem checar isso de novo.
    """
    usuario_id = request.headers.get("X-Usuario-Id")

    if not usuario_id:
        return False, (jsonify({"mensagem": "Cabeçalho X-Usuario-Id ausente."}), 401)

    cursor = mysql.connection.cursor()
    dono_id = _dono_da_lavoura(cursor, lavoura_id)
    cursor.close()

    if dono_id is None:
        return False, (jsonify({"mensagem": "Lavoura não encontrada"}), 404)

    if str(dono_id) != str(usuario_id):
        return False, (jsonify({"mensagem": "Você não tem permissão para acessar esta lavoura."}), 403)

    return True, None

def calcular_area_m2(coordenadas):
    if len(coordenadas) < 3:
        return 0

    R = 6371000  # raio médio da Terra em metros

    lat_media = sum(ponto["lat"] for ponto in coordenadas) / len(coordenadas)
    lat_media_rad = math.radians(lat_media)

    pontos = []

    for ponto in coordenadas:
        x = math.radians(ponto["lng"]) * R * math.cos(lat_media_rad)
        y = math.radians(ponto["lat"]) * R
        pontos.append((x, y))

    area = 0

    for i in range(len(pontos)):
        x1, y1 = pontos[i]
        x2, y2 = pontos[(i + 1) % len(pontos)]

        area += (x1 * y2) - (x2 * y1)

    return abs(area) / 2


def init_mysql(mysql_instance):
    global mysql
    mysql = mysql_instance


def validar_safras(valor):
    if not isinstance(valor, list) or not 1 <= len(valor) <= 30:
        raise ValueError("Informe entre 1 e 30 safras.")

    resultado = []
    anos = set()

    for item in valor:
        if not isinstance(item, dict):
            raise ValueError("Formato de safra inválido.")

        ano_texto = str(item.get("ano", ""))

        if not ano_texto.isdigit():
            raise ValueError("O ano da safra deve ser um número inteiro.")

        ano = int(ano_texto)

        try:
            inicio = date.fromisoformat(item["inicio"])
            fim = date.fromisoformat(item["fim"])
        except (KeyError, TypeError, ValueError):
            raise ValueError(
                "Informe início e fim válidos para todas as safras."
            ) from None

        if not 2017 <= ano <= date.today().year:
            raise ValueError("Ano de safra inválido.")

        if not date(2017, 3, 28) <= inicio <= fim <= date.today():
            raise ValueError(
                "Os períodos devem estar entre 28/03/2017 e hoje, "
                "com início anterior ou igual ao fim."
            )

        if ano in anos:
            raise ValueError("Cada ano de safra deve aparecer apenas uma vez.")

        anos.add(ano)

        resultado.append({
            "ano": ano,
            "inicio": inicio.isoformat(),
            "fim": fim.isoformat(),
        })

    resultado.sort(key=lambda safra: safra["inicio"])

    for anterior, atual in zip(resultado, resultado[1:]):
        if atual["inicio"] <= anterior["fim"]:
            raise ValueError("Os períodos das safras não podem se sobrepor.")

    return resultado

# CADASTRAR LAVOURA
@lavoura_bp.route('/lavoura', methods=['POST'])

def cadastrar_lavoura():
    dados = request.get_json()

    usuario_id = dados.get('usuarioId')
    nome_lavoura = dados.get('nomeLavoura')
    coordenadas = dados.get('coordenadas')

    try:
        safras = validar_safras(dados.get("safras"))
    except ValueError as erro:
        return jsonify({"mensagem": str(erro)}), 400

    crs = dados.get('crs', 'EPSG:4326')
    crs_transformation = dados.get("crsTransformation")

    if not usuario_id or not nome_lavoura or not coordenadas:
        return jsonify({
            "mensagem": "Todos os campos são obrigatórios"
        }), 400

    if len(coordenadas) < 3:
        return jsonify({
            "mensagem": "O polígono precisa de pelo menos 3 pontos"
        }), 400

    area_m2 = calcular_area_m2(coordenadas)
    coordenadas_json = json.dumps(coordenadas)

    try:
        cursor = mysql.connection.cursor()

        cursor.execute(
    """
    INSERT INTO lavouras
    (
        usuario_id,
        nome_lavoura,
        coordenadas,
        area_m2,
        crs,
        crs_transformation,
        safras
    )
    VALUES (%s, %s, %s, %s, %s, %s, %s)
    """,
    (
        usuario_id,
        nome_lavoura,
        coordenadas_json,
        area_m2,
        crs,
        crs_transformation,
        json.dumps(safras),
    ),
)

            # Guarda o ID antes de fechar o cursor.
        lavoura_id = cursor.lastrowid

        # Primeiro confirma o cadastro no banco.
        mysql.connection.commit()
        cursor.close()

        # Depois solicita as imagens da nova lavoura.
        mapas = solicitar_mapas(
            lavoura_id,
            usuario_id,
            coordenadas,
            safras=safras,
        )

        return jsonify({
            "id": lavoura_id,
            "mensagem": "Lavoura cadastrada com sucesso",
            "mapas": mapas,
        }), 201

    except Exception as erro:
        print("ERRO AO CADASTRAR LAVOURA:", repr(erro))

        try:
            mysql.connection.rollback()
        except:
            pass

        return jsonify({
            "mensagem": "Erro ao cadastrar lavoura",
            "erro": str(erro)
        }), 500

# LISTAR TODAS AS LAVOURAS (TODOS OS PRODUTORES)
# Usado pelo backend_indices para processar automaticamente
@lavoura_bp.route('/lavouras', methods=['GET'])
def listar_todas_lavouras():

    try:

        cursor = mysql.connection.cursor()

        cursor.execute(
             """
            SELECT
                l.id,
                l.usuario_id,
                l.nome_lavoura,
                l.coordenadas,
                l.area_m2,
                u.nome,
                l.crs,
                l.crs_transformation
            FROM lavouras l
            JOIN usuarios u
                ON l.usuario_id = u.id
            ORDER BY l.id
            """
        )

        resultados = cursor.fetchall()

        cursor.close()

        lavouras = []

        for linha in resultados:

            lavouras.append({   
                "id": linha[0],
                "usuarioId": linha[1],
                "nomeLavoura": linha[2],
                "coordenadas": json.loads(linha[3]),
                "areaM2": float(linha[4]) if linha[4] is not None else 0,
                "produtorNome": linha[5],
                "crs": linha[6],
                "crsTransformation": linha[7]
            })

        return jsonify(lavouras), 200

    except Exception as erro:

        return jsonify({
            "mensagem": "Erro ao buscar lavouras",
            "erro": str(erro)
        }), 500

# LISTAR LAVOURAS DO USUÁRIO
@lavoura_bp.route('/lavouras/<int:usuario_id>', methods=['GET'])
def listar_lavouras(usuario_id):

    try:

        cursor = mysql.connection.cursor()

        cursor.execute(
            """
            SELECT
                l.id,
                l.nome_lavoura,
                l.coordenadas,
                l.criado_em,
                l.usuario_id,
                u.nome,
                l.area_m2
            FROM lavouras l
            JOIN usuarios u
                ON l.usuario_id = u.id
            WHERE l.usuario_id = %s
            ORDER BY l.id
            """,
            (usuario_id,)
        )

        resultados = cursor.fetchall()

        cursor.close()

        lavouras = []

        for linha in resultados:

            lavouras.append({
            "id": linha[0],
            "nomeLavoura": linha[1],
            "coordenadas": json.loads(linha[2]),
            "criadoEm": linha[3].isoformat(),
            "usuarioId": linha[4],
            "produtorNome": linha[5],
            "areaHectares": float(linha[6] / 10000) if linha[6] is not None else 0
        })

        return jsonify(lavouras), 200

    except Exception as erro:

        return jsonify({
            "mensagem": "Erro ao buscar lavouras",
            "erro": str(erro)
        }), 500

# BUSCAR UMA LAVOURA PELO ID
@lavoura_bp.route('/lavoura/<int:lavoura_id>', methods=['GET'])
def buscar_lavoura(lavoura_id):

    ok, erro = _exige_dono(lavoura_id)
    if not ok:
        return erro

    try:

        cursor = mysql.connection.cursor()

        cursor.execute(
          """
            SELECT
                l.id,
                l.nome_lavoura,
                l.coordenadas,
                l.area_m2,
                l.usuario_id,
                u.nome
            FROM lavouras l
            JOIN usuarios u
                ON l.usuario_id = u.id
            WHERE l.id = %s
            """,
            (lavoura_id,)
        )

        linha = cursor.fetchone()

        cursor.close()

        if not linha:

            return jsonify({
                "mensagem": "Lavoura não encontrada"
            }), 404

        lavoura = {
            "id": linha[0],

            "nomeLavoura": linha[1],

            "coordenadas": json.loads(linha[2]),

            "areaM2": (
                float(linha[3])
                if linha[3] is not None
                else 0
            ),

            "usuarioId": linha[4],

            "produtorNome": linha[5]
        }

        return jsonify(lavoura), 200

    except Exception as erro:

        return jsonify({
            "mensagem": "Erro ao buscar lavoura",
            "erro": str(erro)
        }), 500

    
@lavoura_bp.route('/lavoura/<int:lavoura_id>', methods=['PUT'])
def editar_lavoura(lavoura_id):

    ok, erro = _exige_dono(lavoura_id)
    if not ok:
        return erro

    dados = request.get_json()

    nome_lavoura = dados.get('nomeLavoura')
    coordenadas = dados.get('coordenadas')

    if not nome_lavoura and coordenadas is None:
        return jsonify({
            "mensagem": "Nenhum dado foi enviado para alteração"
        }), 400

    try:

        cursor = mysql.connection.cursor()
        cursor.execute(
            """
            SELECT coordenadas, usuario_id
            FROM lavouras
            WHERE id = %s
            """,
            (lavoura_id,),
        )

        anterior = cursor.fetchone()

        if not anterior:
            cursor.close()

            return jsonify({
                "mensagem": "Lavoura não encontrada"
            }), 404

        # Só gera novamente se os pontos enviados forem diferentes.
        mudou_contorno = (
            coordenadas is not None
            and json.loads(anterior[0]) != coordenadas
        )

        # Nome + coordenadas
        if nome_lavoura is not None and coordenadas is not None:

            if len(coordenadas) < 3:
                return jsonify({
                    "mensagem": "O polígono precisa de pelo menos 3 pontos"
                }), 400

            area_m2 = calcular_area_m2(coordenadas)
            coordenadas_json = json.dumps(coordenadas)

            cursor.execute(
                """
                UPDATE lavouras
                SET nome_lavoura = %s,
                    coordenadas = %s,
                    area_m2 = %s
                WHERE id = %s
                """,
                (
                    nome_lavoura,
                    coordenadas_json,
                    area_m2,
                    lavoura_id
                )
            )

        # Somente nome
        elif nome_lavoura is not None:

            cursor.execute(
                """
                UPDATE lavouras
                SET nome_lavoura = %s
                WHERE id = %s
                """,
                (
                    nome_lavoura,
                    lavoura_id
                )
            )

        # Somente coordenadas
        elif coordenadas is not None:

            if len(coordenadas) < 3:
                return jsonify({
                    "mensagem": "O polígono precisa de pelo menos 3 pontos"
                }), 400

            area_m2 = calcular_area_m2(coordenadas)
            coordenadas_json = json.dumps(coordenadas)

            cursor.execute(
                """
                UPDATE lavouras
                SET coordenadas = %s,
                    area_m2 = %s
                WHERE id = %s
                """,
                (
                    coordenadas_json,
                    area_m2,
                    lavoura_id
                )
            )

        mysql.connection.commit()
        cursor.close()

        mapas = None

        if mudou_contorno:
            mapas = solicitar_mapas(
                lavoura_id,
                anterior[1],
                coordenadas,
            )

        return jsonify({
            "mensagem": "Lavoura atualizada com sucesso",
            "mapas": mapas,
        }), 200

    except Exception as erro:

        return jsonify({
            "mensagem": "Erro ao atualizar lavoura",
            "erro": str(erro)
        }), 500


@lavoura_bp.route('/lavoura/<int:lavoura_id>', methods=['DELETE'])
def remover_lavoura(lavoura_id):

    ok, erro = _exige_dono(lavoura_id)
    if not ok:
        return erro

    try:
        cursor = mysql.connection.cursor()

        cursor.execute(
            """
            DELETE FROM indices_vegetacao
            WHERE lavoura_id = %s
            """,
            (lavoura_id,)
        )

        cursor.execute(
            """
            DELETE FROM clima
            WHERE lavoura_id = %s
            """,
            (lavoura_id,)
        )

        cursor.execute(
            """
            DELETE FROM observacoes
            WHERE lavoura_id = %s
            """,
            (lavoura_id,)
        )

        cursor.execute(
            """
            DELETE FROM log_auditoria
            WHERE lavoura_id = %s
            """,
            (lavoura_id,)
        )

        cursor.execute(
            """
            DELETE FROM imagens
            WHERE lavoura_id = %s
            """,
            (lavoura_id,)
        )

        cursor.execute(
            """
            DELETE FROM lavouras
            WHERE id = %s
            """,
            (lavoura_id,)
        )

        mysql.connection.commit()
        cursor.close()

        return jsonify({
            "mensagem": "Lavoura removida com sucesso"
        }), 200

    except Exception as erro:
        print("ERRO AO REMOVER LAVOURA:", repr(erro))

        try:
            mysql.connection.rollback()
        except:
            pass

        return jsonify({
            "mensagem": "Erro ao remover lavoura",
            "erro": str(erro)
        }), 500


    
@lavoura_bp.route('/laudo/enviar_email', methods=['POST'])
def enviar_laudo_email():

    dados = request.get_json()

    lavoura_id = dados.get('lavouraId')
    pdf_base64 = dados.get('pdfBase64')
    nome_arquivo = dados.get('nomeArquivo') or 'laudo.pdf'
    remetente_id = dados.get('usuarioId')  # quem clicou em "enviar" (produtor ou agrônomo)

    if not lavoura_id or not pdf_base64:
        return jsonify({
            "mensagem": "lavouraId e pdfBase64 são obrigatórios"
        }), 400

    try:
        cursor = mysql.connection.cursor()

        # descobre o dono (produtor) da lavoura
        cursor.execute(
            "SELECT usuario_id, nome_lavoura FROM lavouras WHERE id = %s",
            (lavoura_id,)
        )
        resultado_lavoura = cursor.fetchone()

        if not resultado_lavoura:
            cursor.close()
            return jsonify({"mensagem": "Lavoura não encontrada"}), 404

        dono_id, nome_lavoura = resultado_lavoura

        cursor.execute(
            "SELECT nome, email FROM usuarios WHERE id = %s",
            (dono_id,)
        )
        linha_produtor = cursor.fetchone()

        if not linha_produtor:
            cursor.close()
            return jsonify({"mensagem": "Produtor dono da lavoura não encontrado"}), 404

        nome_produtor, email_produtor = linha_produtor

        # se quem enviou for um agrônomo agindo em nome do produtor,
        # busca o nome dele para citar no e-mail
        nome_remetente = nome_produtor
        if remetente_id and str(remetente_id) != str(dono_id):
            cursor.execute(
                "SELECT nome FROM usuarios WHERE id = %s",
                (remetente_id,)
            )
            linha_remetente = cursor.fetchone()
            if linha_remetente:
                nome_remetente = linha_remetente[0]

        cursor.close()

        if not email_produtor:
            return jsonify({"mensagem": "Produtor não possui e-mail cadastrado"}), 400

        html, texto = montar_email_laudo(nome_produtor, nome_lavoura, nome_remetente)

        enviar_email(
            email_produtor,
            f"CoffeeVision — Laudo técnico: {nome_lavoura}",
            html,
            texto,
            anexos=[{"content": pdf_base64, "name": nome_arquivo}],
        )

        return jsonify({
            "mensagem": "Laudo enviado por e-mail com sucesso",
            "email": email_produtor
        }), 200

    except Exception as erro:
        print("ERRO AO ENVIAR LAUDO POR E-MAIL:", repr(erro))

        return jsonify({
            "mensagem": "Erro ao enviar laudo por e-mail",
            "erro": str(erro)
        }), 500

@lavoura_bp.route(
    "/lavoura/<int:lavoura_id>/gerar-imagens",
    methods=["POST"],
)
def gerar_imagens_lavoura(lavoura_id):
    ok, erro = _exige_dono(lavoura_id)

    if not ok:
        return erro

    cursor = mysql.connection.cursor()

    try:
        cursor.execute(
            """
            SELECT usuario_id, coordenadas, safras
            FROM lavouras
            WHERE id = %s
            """,
            (lavoura_id,),
        )

        linha = cursor.fetchone()

    finally:
        cursor.close()

    if not linha:
        return jsonify({
            "mensagem": "Lavoura não encontrada."
        }), 404

    resultado = solicitar_mapas(
    lavoura_id,
    linha[0],
    json.loads(linha[1]),
    safras=json.loads(linha[2]) if linha[2] else [],
)

    codigo = 202 if resultado["status"] == "aceito" else 503

    return jsonify(resultado), codigo