
Config · PY
import os
from dotenv import load_dotenv
 
load_dotenv()
 
class Config:
    MYSQL_HOST = os.getenv("DB_HOST")
    MYSQL_USER = os.getenv("DB_USER")
    MYSQL_PASSWORD = os.getenv("DB_PASSWORD")
    MYSQL_DB = os.getenv("DB_NAME")
 
    # Porta do banco. Localmente o MySQL usa 3306 por padrão,
    # mas provedores em nuvem (como a Aiven) usam portas customizadas.
    MYSQL_PORT = int(os.getenv("DB_PORT", 3306))
 
    # Certificado SSL/CA. Necessário para conectar em bancos na nuvem
    # que exigem conexão criptografada (ex: Aiven usa ssl-mode=REQUIRED).
    # Se DB_SSL_CA não estiver definido no .env, o SSL fica desativado
    # (comportamento normal para MySQL local, que não exige SSL).
    _ssl_ca = os.getenv("DB_SSL_CA")
    if _ssl_ca:
        MYSQL_SSL_CA = _ssl_ca
