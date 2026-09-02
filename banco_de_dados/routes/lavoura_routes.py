from flask import Blueprint, request, jsonify
import json

lavoura_bp = Blueprint('lavoura', __name__)

mysql = None


def init_mysql(mysql_instance):
    global mysql
    mysql = mysql_instance


# ==========================================
# CADASTRAR LAVOURA
# ==========================================

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


# ==========================================
# LISTAR LAVOURAS DO USUÁRIO
# ==========================================

@lavoura_bp.route('/lavouras/<int:usuario_id>', methods=['GET'])
def listar_lavouras(usuario_id):

    try:

        cursor = mysql.connection.cursor()

        cursor.execute(
            """
            SELECT
                id,
                nome_lavoura,
                coordenadas,
                criado_em
            FROM lavouras
            WHERE usuario_id = %s
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
                "criadoEm": linha[3].isoformat()
            })

        return jsonify(lavouras), 200

    except Exception as erro:

        return jsonify({
            "mensagem": "Erro ao buscar lavouras",
            "erro": str(erro)
        }), 500


# ==========================================
# BUSCAR UMA LAVOURA PELO ID
# ==========================================

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

        cursor.execute(
            """
            DELETE FROM lavouras
            WHERE id = %s
            """,
            (lavoura_id,)
        )

        if cursor.rowcount == 0:
            cursor.close()
            return jsonify({
                "mensagem": "Lavoura não encontrada"
            }), 404

        mysql.connection.commit()
        cursor.close()

        return jsonify({
            "mensagem": "Lavoura removida com sucesso"
        }), 200

    except Exception as erro:
        print("ERRO AO REMOVER LAVOURA:", repr(erro))
        return jsonify({
            "mensagem": "Erro ao remover lavoura",
            "erro": str(erro)
        }), 500