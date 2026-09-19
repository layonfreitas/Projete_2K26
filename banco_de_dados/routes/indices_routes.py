from flask import Blueprint, request, jsonify

indices_bp = Blueprint('indices_vegetacao', __name__)

mysql = None  # vai ser injetado pelo app.py

def init_mysql(mysql_instance):
    global mysql
    mysql = mysql_instance


def linear_interpol(x,x0,y0,x1,y1):
    return y0 +(x-x0)*(y1-y0)/(x1-x0) 


@indices_bp.route('/create_serie_temporal', methods=['POST'])
def salvar_serie_temporal():
    dados = request.get_json()
    
    try:

        serie_temporal = [(dia['lavouraId'], dia('tipoIndice'), dia('valor'), dia('grausDia'), dia('dataReferencia')) for dia in dados]
        query = "INSERT INTO indices_vegetacao (lavoura_id, tipo_indice, valor, graus_dia, data_referencia), VALUES (%s, %s, %s, %s, %s)"
        cursor = mysql.connection.cursor()
        cursor.executemany(query, serie_temporal)
        mysql.connection.commit()
        mysql.close()
        return jsonify({"mensagem": "Série temporal registrado com sucesso"}), 201
    
    except Exception as erro:
        mysql.connection.rollback()
        return jsonify({"mensagem": "Erro ao registrar série temporal", "erro": str(erro)}), 500

@indices_bp.route('/acessar_serie_temporal', methods=['GET'])
def acessar_serie_temporal():
    graus_dia = float(request.args.get('grausDia'))
    try:
        resultados = []
        indices = ["NDVI","NDRE", "NDVI"]
        cursor = mysql.connection.cursor()
        for indice in indices:
            query = """
                        (
                            SELECT graus_dia, valor
                            FROM indices_vegetacao
                            WHERE graus_dia<= %s
                            ORDER BY graus_dia DESC
                            LIMIT 1
                        );
                        (
                            SELECT graus_dia, valor
                            FROM indices_vegetacao
                            WHERE graus_dia>= %s
                            ORDER BY graus_dia ASC
                            LIMIT 1

                        );
                            """
            cursor.execute(query, (graus_dia, graus_dia))
            linhas = cursor.fetchall()
            if not linhas:
                return jsonify({"erro": "Nenhum dado encontrado na série histórica."}), 404

            valor_indice = None

            if linhas[0][0] == graus_dia:
                valor_indice = linhas[0][1]

            elif linhas[1][0] == graus_dia:
                valor_indice = linhas[1][1]

            else:
                x0,y0 = linhas[0][0], linhas[0][1]
                x1,y1 = linhas[1][0], linhas[1][1]
                valor_indice = linear_interpol(x=graus_dia, x0=x0, y0=y0, x1=x1, y1=y1)

            resultados.append({
                "tipoIndice": indice,
                "valor": valor_indice
            })

        return jsonify(resultados),200

    except Exception as erro:
        mysql.connection.rollback()
        return jsonify({"mensagem": "Não foi possível encontrar o valor do índice", "erro": str(erro)}), 500
        

@indices_bp.route('/indices_vegetacao', methods=['POST'])
def salvar_indice():
    dados = request.get_json()
    lavoura_id = dados.get('lavouraId')
    imagem_id = dados.get('imagemId')  # opcional
    tipo_indice = dados.get('tipoIndice')  # 'NDVI' | 'NDRE' | 'NDWI'
    valor = dados.get('valor')
    data_referencia = dados.get('dataReferencia')
    graus_dia = dados.get('grausDia')

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
