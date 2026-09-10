from flask import Blueprint, request, jsonify

indices_bp = Blueprint('indices_vegetacao', __name__)
mysql = None  # vai ser injetado pelo app.py

def init_mysql(mysql_instance):
    global mysql
    mysql = mysql_instance


@indices_bp.route('/indices_vegetacao', methods=['POST'])
def salvar_indice():
    dados = request.get_json()
    lavoura_id = dados.get('lavouraId')
    imagem_id = dados.get('imagemId')  # opcional
    tipo_indice = dados.get('tipoIndice')  # 'NDVI' | 'NDRE' | 'NDWI'
    valor = dados.get('valor')
    data_referencia = dados.get('dataReferencia')

    if not lavoura_id or not tipo_indice or valor is None or not data_referencia:
        return jsonify({
            "mensagem": "lavouraId, tipoIndice, valor e dataReferencia são obrigatórios"
        }), 400

    try:
        cursor = mysql.connection.cursor()
        cursor.execute(
            """
            INSERT INTO indices_vegetacao (lavoura_id, imagem_id, tipo_indice, valor, data_referencia)
            VALUES (%s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE valor = VALUES(valor), imagem_id = VALUES(imagem_id)
            """,
            (lavoura_id, imagem_id, tipo_indice, valor, data_referencia)
        )
        mysql.connection.commit()
        cursor.close()
        return jsonify({"mensagem": "Índice registrado com sucesso"}), 201
    except Exception as erro:
        mysql.connection.rollback()
        return jsonify({"mensagem": "Erro ao registrar índice", "erro": str(erro)}), 500


@indices_bp.route('/indices_vegetacao/<int:lavoura_id>', methods=['GET'])
def historico_indices(lavoura_id):
    tipo_indice = request.args.get('tipo')  # filtro opcional: NDVI, NDRE, NDWI

    try:
        cursor = mysql.connection.cursor()

        if tipo_indice:
            cursor.execute(
                """
                SELECT tipo_indice, valor, data_referencia
                FROM indices_vegetacao
                WHERE lavoura_id = %s AND tipo_indice = %s
                ORDER BY data_referencia ASC
                """,
                (lavoura_id, tipo_indice)
            )
        else:
            cursor.execute(
                """
                SELECT tipo_indice, valor, data_referencia
                FROM indices_vegetacao
                WHERE lavoura_id = %s
                ORDER BY data_referencia ASC
                """,
                (lavoura_id,)
            )

        linhas = cursor.fetchall()
        cursor.close()

        resultado = [
            {
                "tipoIndice": linha[0],
                "valor": float(linha[1]),
                "dataReferencia": linha[2].isoformat() if hasattr(linha[2], 'isoformat') else str(linha[2]),
            }
            for linha in linhas
        ]

        return jsonify(resultado), 200
    except Exception as erro:
        return jsonify({"mensagem": "Erro ao buscar histórico de índices", "erro": str(erro)}), 500
