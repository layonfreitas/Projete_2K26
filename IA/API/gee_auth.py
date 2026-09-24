import os
from pathlib import Path

import ee
from dotenv import load_dotenv
from google.oauth2 import service_account


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


def inicializar_gee():
    projeto = os.getenv("GEE_PROJECT")
    arquivo = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

    if not projeto:
        raise RuntimeError(
            "Configure a variável GEE_PROJECT no Render."
        )

    if not arquivo:
        raise RuntimeError(
            "Configure GOOGLE_APPLICATION_CREDENTIALS "
            "com o caminho do JSON da conta de serviço."
        )

    caminho = Path(arquivo)

    if not caminho.is_absolute():
        caminho = BASE_DIR / caminho

    if not caminho.is_file():
        raise RuntimeError(
            f"Arquivo de credenciais não encontrado: {caminho}"
        )

    credenciais = service_account.Credentials.from_service_account_file(
        str(caminho),
        scopes=["https://www.googleapis.com/auth/earthengine"],
    )

    ee.Initialize(
        credentials=credenciais,
        project=projeto,
    )

    print("Earth Engine inicializado com sucesso.")