import os
import sys
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


# Pasta IA/API.
BASE_DIR = Path(__file__).resolve().parent

# Pasta raiz do projeto: Projete_2K26.
RAIZ_PROJETO = BASE_DIR.parent.parent

# Permite importar gee_auth.py da pasta backend_indices.
sys.path.insert(0, str(RAIZ_PROJETO / "backend_indices"))

# Garante que os módulos encontrem os modelos dentro de IA/API.
os.chdir(BASE_DIR)


# Importa as aplicações existentes.
from classificar import app as classificar_app
from CLMI_clf import app as clmi_app
from get_crs import app as crs_app


app = FastAPI(
    title="CoffeeVision - IA",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://projete-2k26-frontend.onrender.com",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Registra as rotas e seus ciclos de inicialização.
app.include_router(classificar_app.router)
app.include_router(clmi_app.router)
app.include_router(crs_app.router)


if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
    )