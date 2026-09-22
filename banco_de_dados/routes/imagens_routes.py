import json
import math
import hashlib
from flask import Blueprint, request, jsonify

cadastrar_imagens_bp = Blueprint('cadastrar_imagens', __name__)
acessar_imagem_bp = Blueprint('acessar_imagem', __name__)
listar_imagens_bp = Blueprint('listar_imagens', __name__)
get_indices_valores_bp = Blueprint('get_indices_valores', __name__)
mysql = None


def init_mysql(mysql_instance):
    global mysql
    mysql = mysql_instance


def validar_georreferencia(meta, usuario_id, lavoura_id):
    if not isinstance(meta, dict) or meta.get('versao') not in (1, 2) or meta.get('crs') != 'EPSG:3857':
        raise ValueError('Georreferência inválida.')
    if int(meta['usuarioId']) != int(usuario_id) or int(meta['lavouraId']) != int(lavoura_id):
        raise ValueError('A imagem pertence a outra lavoura ou usuário.')
    (sul, oeste), (norte, leste) = meta['bounds']
    if not all(isinstance(v, (int, float)) and math.isfinite(v) for v in [sul, oeste, norte, leste]):
        raise ValueError('Limites inválidos.')
    if not (-85 < sul < norte < 85 and -180 <= oeste < leste <= 180):
        raise ValueError('Limites inválidos.')
    geometria = meta.get('geometria')
    if not isinstance(geometria, dict) or geometria.get('type') != 'Polygon' or not geometria.get('coordinates'):
        raise ValueError('Geometria da imagem ausente.')
    for anel in geometria['coordinates']:
        if not isinstance(anel, list) or len(anel) < 4 or anel[0] != anel[-1]:
            raise ValueError('Contorno inválido.')
        for ponto in anel:
            lng, lat = ponto
            if not all(isinstance(v, (int, float)) and math.isfinite(v) for v in ponto):
                raise ValueError('Ponto inválido.')
            if not (oeste-1e-8 <= lng <= leste+1e-8 and sul-1e-8 <= lat <= norte+1e-8):
                raise ValueError('Contorno fora dos limites.')
    if meta['versao'] == 2:
        if not all(isinstance(meta.get(k), int) and 1 <= meta[k] <= 1024 for k in ('largura','altura')):
            raise ValueError('Dimensões inválidas.')
        if not 0 < meta.get('pixelsVisiveis',0) <= meta['largura']*meta['altura']:
            raise ValueError('Mapa sem pixels visíveis.')



@cadastrar_imagens_bp.route('/imagens', methods=['POST'])
def cadastrar_imagem():
    dados = request.get_json(silent=True) or {}

    usuario_id = dados.get("usuarioId")
    lavoura_id = dados.get("lavouraId")
    data_imagem = dados.get("dataImagem")
    url_imagem = dados.get("urlImagem")
    indice = dados.get("indice")
    valor_indice = dados.get("valorIndice")
    meta = dados.get("georreferencia")

    if not all([
        usuario_id,
        lavoura_id,
        data_imagem,
        url_imagem,
        indice,
    ]):
        return jsonify({
            "mensagem": "Todos os campos são obrigatórios."
        }), 400

    if meta is not None:
        try:
            validar_georreferencia(
                meta,
                usuario_id,
                lavoura_id,
            )
        except (ValueError, TypeError, KeyError):
            return jsonify({
                "mensagem": "Georreferência inválida."
            }), 400

    # Define os parâmetros antes de executar as consultas.
    chave = (
        lavoura_id,
        usuario_id,
        data_imagem,
        indice,
    )

    cursor = None
    lock_nome = None

    try:
        cursor = mysql.connection.cursor()

        # Primeiro verifica se a lavoura pertence ao usuário.
        cursor.execute(
            """
            SELECT id
            FROM lavouras
            WHERE id = %s
              AND usuario_id = %s
            """,
            (lavoura_id, usuario_id),
        )

        if not cursor.fetchone():
            return jsonify({
                "mensagem": "Lavoura não encontrada."
            }), 404

        # Evita dois salvamentos simultâneos da mesma chave.
        nome_trava = (
            "mapa_"
            + hashlib.sha256(
                "|".join(map(str, chave)).encode()
            ).hexdigest()[:48]
        )

        cursor.execute(
            "SELECT GET_LOCK(%s, 10)",
            (nome_trava,),
        )

        resultado_trava = cursor.fetchone()

        if not resultado_trava or resultado_trava[0] != 1:
            return jsonify({
                "mensagem": (
                    "Essa imagem já está sendo salva. "
                    "Tente novamente."
                )
            }), 409

        # Só registra a trava depois de conseguir adquiri-la.
        lock_nome = nome_trava

        # Busca as imagens da mesma lavoura, data e índice.
        cursor.execute(
            """
            SELECT id, georreferencia
            FROM imagens
            WHERE lavoura_id = %s
              AND usuario_id = %s
              AND data_imagem = %s
              AND indice = %s
            ORDER BY id DESC
            """,
            chave,
        )

        imagens_existentes = cursor.fetchall()
        contorno_recebido = chave_contorno(meta)

        # Só considera existente uma imagem do mesmo contorno.
        existente = next(
            (
                linha
                for linha in imagens_existentes
                if chave_contorno(linha[1]) == contorno_recebido
            ),
            None,
        )

        meta_json = (
            json.dumps(meta)
            if meta is not None
            else None
        )

        atualizar = existente is not None and meta is not None

        if atualizar:
            # Atualiza somente o registro do mesmo contorno.
            imagem_id = existente[0]

            cursor.execute(
                """
                UPDATE imagens
                SET url_imagem = %s,
                    valor_indice = %s,
                    georreferencia = %s
                WHERE id = %s
                """,
                (
                    url_imagem,
                    valor_indice,
                    meta_json,
                    imagem_id,
                ),
            )

        else:
            # Um contorno diferente gera outro registro.
            cursor.execute(
                """
                INSERT INTO imagens (
                    usuario_id,
                    lavoura_id,
                    data_imagem,
                    url_imagem,
                    indice,
                    valor_indice,
                    georreferencia
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    usuario_id,
                    lavoura_id,
                    data_imagem,
                    url_imagem,
                    indice,
                    valor_indice,
                    meta_json,
                ),
            )

            imagem_id = cursor.lastrowid

        mysql.connection.commit()

        return jsonify({
            "mensagem": "Imagem salva com sucesso.",
            "id": imagem_id,
        }), 200 if atualizar else 201

    except Exception as erro:
        mysql.connection.rollback()

        return jsonify({
            "mensagem": "Erro ao salvar imagem.",
            "erro": str(erro),
        }), 500

    finally:
        if cursor is not None:
            try:
                if lock_nome is not None:
                    cursor.execute(
                        "SELECT RELEASE_LOCK(%s)",
                        (lock_nome,),
                    )
                    cursor.fetchone()
            finally:
                cursor.close()

@acessar_imagem_bp.route('/acessar_imagem', methods=['GET'])
def acessar_imagem():
    lavoura_id = request.args.get('id')
    usuario_id = request.args.get('usuario_id')
    data = request.args.get('data')
    indice = request.args.get('indice')
    if not all([lavoura_id, usuario_id, data, indice]):
        return jsonify({'mensagem': 'Informe id, usuario_id, data e indice.'}), 400
    cursor = None
    try:
        cursor = mysql.connection.cursor()
        cursor.execute('SELECT coordenadas FROM lavouras WHERE id = %s AND usuario_id = %s', (lavoura_id, usuario_id))
        lavoura = cursor.fetchone()
        if not lavoura:
            return jsonify({'mensagem': 'Lavoura não encontrada.'}), 404
        cursor.execute(
            'SELECT url_imagem, valor_indice, georreferencia FROM imagens '
            'WHERE lavoura_id = %s AND usuario_id = %s AND data_imagem = %s AND indice = %s '
            "ORDER BY COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(georreferencia, '$.versao')) AS UNSIGNED), 0) DESC, id DESC LIMIT 1", 
            (lavoura_id, usuario_id, data, indice)
        )
        linhas = cursor.fetchall()
        contorno = request.args.get("contorno")

        linha = next(
            (
                registro
                for registro in linhas
                if (
                    not contorno
                    or chave_contorno(registro[2]) == contorno
                )
            ),
            None,
        )
        if not linha:
            return jsonify({'mensagem': 'Imagem não encontrada.'}), 404
        meta = json.loads(linha[2]) if isinstance(linha[2], (str, bytes)) else linha[2]
        return jsonify({
            'coordenadas': lavoura[0], 'url': linha[0], 'valor_indice': linha[1],
            'georreferencia': meta, 'precisaReprocessar': not meta or meta.get('versao',0) < 2,
        }), 200
    except Exception as erro:
        return jsonify({'mensagem': 'Não foi possível encontrar os dados.', 'erro': str(erro)}), 500
    finally:
        if cursor is not None:
            cursor.close()

@listar_imagens_bp.route(
    "/imagens/<int:lavoura_id>",
    methods=["GET"],
)
def listar_imagens(lavoura_id):
    usuario_id = request.args.get("usuario_id")

    if not usuario_id:
        return jsonify({
            "mensagem": "Parâmetro usuario_id é obrigatório."
        }), 400

    cursor = None

    try:
        cursor = mysql.connection.cursor()

        cursor.execute(
            """
            SELECT id, data_imagem, indice, georreferencia
            FROM imagens
            WHERE lavoura_id = %s
              AND usuario_id = %s
            ORDER BY id ASC
            """,
            (lavoura_id, usuario_id),
        )

        linhas = cursor.fetchall()

        grupos = {}
        versoes = {}

        for imagem_id, data_imagem, indice, meta in linhas:
            contorno = chave_contorno(meta)

            if contorno not in versoes:
                versoes[contorno] = len(versoes) + 1

            data_str = (
                data_imagem.isoformat()
                if hasattr(data_imagem, "isoformat")
                else str(data_imagem)
            )

            chave = (data_str, contorno)

            grupo = grupos.setdefault(
                chave,
                {
                    "data": data_str,
                    "contorno": contorno,
                    "versaoContorno": versoes[contorno],
                    "indicesDisponiveis": [],
                },
            )

            if indice not in grupo["indicesDisponiveis"]:
                grupo["indicesDisponiveis"].append(indice)

        resultado = sorted(
            grupos.values(),
            key=lambda grupo: (
                grupo["data"],
                grupo["versaoContorno"],
            ),
            reverse=True,
        )

        return jsonify(resultado), 200

    except Exception as erro:
        return jsonify({
            "mensagem": "Erro ao buscar imagens.",
            "erro": str(erro),
        }), 500

    finally:
        if cursor is not None:
            cursor.close()

@get_indices_valores_bp.route('/get_i_valor', methods=['GET'])
def get_indice_valor():
    return jsonify({'mensagem':'Use /indices_vegetacao/<lavoura_id> para consultar os valores.'}), 410
