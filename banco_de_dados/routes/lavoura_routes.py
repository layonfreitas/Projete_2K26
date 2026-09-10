from flask import Blueprint, request, jsonify
import json

from email_utils import enviar_email, montar_email_laudo

lavoura_bp = Blueprint('lavoura', __name__)

mysql = None


def init_mysql(mysql_instance):
    global mysql
    mysql = mysql_instance

# CADASTRAR LAVOURA
@lavoura_bp.route('/lavoura', methods=['POST'])
def cadastrar_lavoura():

    dados = request.get_json()

    usuario_id = dados.get('usuarioId')
    nome_lavoura = dados.get('nomeLavoura')
    coordenadas = dados.get('coordenadas')

    if not usuario_id or not nome_lavoura or not coordenadas:
        return jsonify({
            "mensagem": "Todos os campos são obrigatórios"
        }), 400

    if len(coordenadas) < 3:
        return jsonify({
            "mensagem": "O polígono precisa de pelo menos 3 pontos"
        }), 400

    coordenadas_json = json.dumps(coordenadas)

    try:

        cursor = mysql.connection.cursor()

        cursor.execute(
            """
            INSERT INTO lavouras
            (usuario_id, nome_lavoura, coordenadas)
            VALUES (%s, %s, %s)
            """,
            (
                usuario_id,
                nome_lavoura,
                coordenadas_json
            )
        )

        mysql.connection.commit()
        cursor.close()

        return jsonify({
            "mensagem": "Lavoura cadastrada com sucesso"
        }), 201

    except Exception as erro:

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
                id,
                usuario_id,
                nome_lavoura,
                coordenadas
            FROM lavouras
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
                "coordenadas": json.loads(linha[3])
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
            u.nome
        FROM lavouras l
        JOIN usuarios u ON l.usuario_id = u.id
        WHERE l.usuario_id = %s
   
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
            "produtorNome": linha[5]
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

    try:

        cursor = mysql.connection.cursor()

        cursor.execute(
            """
            SELECT
                id,
                nome_lavoura,
                coordenadas
            FROM lavouras
            WHERE id = %s
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
            "coordenadas": json.loads(linha[2])
        }

        return jsonify(lavoura), 200

    except Exception as erro:

        return jsonify({
            "mensagem": "Erro ao buscar lavoura",
            "erro": str(erro)
        }), 500

    
@lavoura_bp.route('/lavoura/<int:lavoura_id>', methods=['PUT'])
def editar_lavoura(lavoura_id):
    dados = request.get_json()

    nome_lavoura = dados.get('nomeLavoura')
    coordenadas = dados.get('coordenadas')

    if not nome_lavoura and coordenadas is None:
        return jsonify({
            "mensagem": "Nenhum dado foi enviado para alteração"
        }), 400

    try:
        cursor = mysql.connection.cursor()

        if nome_lavoura is not None and coordenadas is not None:
            if len(coordenadas) < 3:
                return jsonify({
                    "mensagem": "O polígono precisa de pelo menos 3 pontos"
                }), 400

            coordenadas_json = json.dumps(coordenadas)

            cursor.execute(
                """
                UPDATE lavouras
                SET nome_lavoura = %s, coordenadas = %s
                WHERE id = %s
                """,
                (nome_lavoura, coordenadas_json, lavoura_id)
            )

        elif nome_lavoura is not None:
            cursor.execute(
                """
                UPDATE lavouras
                SET nome_lavoura = %s
                WHERE id = %s
                """,
                (nome_lavoura, lavoura_id)
            )

        elif coordenadas is not None:
            if len(coordenadas) < 3:
                return jsonify({
                    "mensagem": "O polígono precisa de pelo menos 3 pontos"
                }), 400

            coordenadas_json = json.dumps(coordenadas)

            cursor.execute(
                """
                UPDATE lavouras
                SET coordenadas = %s
                WHERE id = %s
                """,
                (coordenadas_json, lavoura_id)
            )

        if cursor.rowcount == 0:
            cursor.close()
            return jsonify({
                "mensagem": "Lavoura não encontrada"
            }), 404

        mysql.connection.commit()
        cursor.close()

        return jsonify({
            "mensagem": "Lavoura atualizada com sucesso"
        }), 200

    except Exception as erro:
        return jsonify({
            "mensagem": "Erro ao atualizar lavoura",
            "erro": str(erro)
        }), 500


@lavoura_bp.route('/lavoura/<int:lavoura_id>', methods=['DELETE'])
def remover_lavoura(lavoura_id):
    try:
        cursor = mysql.connection.cursor()

        # Verifica se a lavoura existe
        cursor.execute(
            """
            SELECT id
            FROM lavouras
            WHERE id = %s
            """,
            (lavoura_id,)
        )

        lavoura = cursor.fetchone()

        if not lavoura:
            cursor.close()
            return jsonify({
                "mensagem": "Lavoura não encontrada"
            }), 404

        # Remove os registros relacionados à lavoura
        cursor.execute(
            """
            DELETE FROM observacoes
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
            DELETE FROM log_auditoria
            WHERE lavoura_id = %s
            """,
            (lavoura_id,)
        )

        # Remove a lavoura
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