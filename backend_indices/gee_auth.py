import os
import base64
import tempfile

import google.auth

# Escopos exigidos pelo Earth Engine. google.auth.default() sozinho não
# define escopo nenhum quando usa uma chave de service account, e sem
# escopo o Google recusa o token com "invalid_scope".
EE_SCOPES = [
    "https://www.googleapis.com/auth/earthengine",
    "https://www.googleapis.com/auth/devstorage.full_control",
    "https://www.googleapis.com/auth/cloud-platform",
]


def configurar_credenciais_google():

    b64 = os.environ.get("GOOGLE_CREDENTIALS_JSON_B64")

    if not b64:
        print("[gee_auth] GOOGLE_CREDENTIALS_JSON_B64 não definida — usando credenciais padrão do ambiente (gcloud local).")
        return

    conteudo = base64.b64decode(b64)
    arquivo_temp = tempfile.NamedTemporaryFile(delete=False, suffix=".json")
    arquivo_temp.write(conteudo)
    arquivo_temp.close()

    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = arquivo_temp.name
    print(f"[gee_auth] Credencial do Google carregada a partir de GOOGLE_CREDENTIALS_JSON_B64 (arquivo temporário: {arquivo_temp.name})")


def obter_credenciais():
    """
    Faz tudo de uma vez: prepara a credencial (se estiver no Render) e
    retorna (credentials, project_id) já com os escopos corretos para
    o Earth Engine funcionar.
    """
    configurar_credenciais_google()
    return google.auth.default(scopes=EE_SCOPES)