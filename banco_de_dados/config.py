import os
import base64
import tempfile
from dotenv import load_dotenv

load_dotenv()

class Config:
    MYSQL_HOST = os.getenv("DB_HOST")
    MYSQL_USER = os.getenv("DB_USER")
    MYSQL_PASSWORD = os.getenv("DB_PASSWORD")
    MYSQL_DB = os.getenv("DB_NAME")
    EMAIL_HOST = os.getenv("EMAIL_HOST")
    EMAIL_PORT = int(os.getenv("EMAIL_PORT", 587))
    EMAIL_USER = os.getenv("EMAIL_USER")
    EMAIL_SENHA = os.getenv("EMAIL_SENHA")

    # Porta do banco. Localmente o MySQL usa 3306 por padrão,
    # mas provedores em nuvem (como a Aiven) usam portas customizadas.
    MYSQL_PORT = int(os.getenv("DB_PORT", 3306))

    # Certificado SSL/CA. Necessário para conectar em bancos na nuvem
    # que exigem conexão criptografada (ex: Aiven usa ssl-mode=REQUIRED).
    #
    # Duas formas de fornecer o certificado:
    # 1) DB_SSL_CA: caminho para um arquivo .pem já existente no disco
    #    (usado localmente, quando você baixou o aiven-ca.pem).
    # 2) DB_SSL_CA_B64: o conteúdo do certificado em base64, numa única
    #    linha (usado no Render/nuvem, onde não dá pra "enviar" um
    #    arquivo — só variáveis de ambiente). Se essa variável existir,
    #    o certificado é decodificado e escrito num arquivo temporário
    #    automaticamente na hora que o app sobe.
    #
    # Se nenhuma das duas estiver definida, o SSL fica desativado
    # (comportamento normal para MySQL local, que não exige SSL).
    _ssl_ca_b64 = os.getenv("DB_SSL_CA_B64")
    _ssl_ca_path = os.getenv("DB_SSL_CA")

    if _ssl_ca_b64:
        _cert_bytes = base64.b64decode(_ssl_ca_b64)
        _tmp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".pem")
        _tmp_file.write(_cert_bytes)
        _tmp_file.close()
        MYSQL_SSL_CA = _tmp_file.name
    elif _ssl_ca_path:
        MYSQL_SSL_CA = _ssl_ca_path