from functools import wraps
from flask import request, jsonify

mysql = None


def init_mysql(mysql_instance):
    global mysql
    mysql = mysql_instance


def _buscar_tipo_usuario(usuario_id):
    cursor = mysql.connection.cursor()
    cursor.execute("SELECT tipo FROM usuarios WHERE id = %s", (usuario_id,))
    resultado = cursor.fetchone()
    cursor.close()
    return resultado  # (tipo,) ou None


def requer_tipo(*tipos_permitidos):
    """Decorator: só deixa passar se o usuário do header X-Usuario-Id
    tiver um dos tipos em `tipos_permitidos` (ex: 'cooperativa')."""

    def decorador(funcao):
        @wraps(funcao)
        def wrapper(*args, **kwargs):
            usuario_id = request.headers.get("X-Usuario-Id")

            if not usuario_id:
                return jsonify({"mensagem": "Cabeçalho X-Usuario-Id ausente."}), 401

            resultado = _buscar_tipo_usuario(usuario_id)
            if not resultado:
                return jsonify({"mensagem": "Usuário não encontrado."}), 401

            tipo = resultado[0]
            if tipo not in tipos_permitidos:
                return jsonify({"mensagem": "Você não tem permissão para essa ação."}), 403

            return funcao(*args, **kwargs)
        return wrapper
    return decorador