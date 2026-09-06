import os
import base64
import tempfile


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