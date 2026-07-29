#!/bin/bash
# Coffee Vision - Launcher (Git Bash / Linux / macOS)

echo "=========================================="
echo "  Iniciando Coffee Vision (Backend + Frontend)"
echo "=========================================="
echo ""

# Descobre automaticamente a pasta onde este script esta localizado
DIR="$(cd "$(dirname "$0")" && pwd)"

# ---- Detecta o sistema operacional ----
OS_TYPE="$(uname -s)"

# ---- Verifica se Python esta instalado ----
if command -v python >/dev/null 2>&1; then
    PYTHON_CMD=python
elif command -v python3 >/dev/null 2>&1; then
    PYTHON_CMD=python3
else
    echo "[ERRO] Python nao encontrado. Instale em https://www.python.org/downloads/"
    read -p "Pressione Enter para sair..."
    exit 1
fi

# ---- Verifica se npm esta instalado ----
if ! command -v npm >/dev/null 2>&1; then
    echo "[ERRO] Node.js/npm nao encontrado. Instale em https://nodejs.org/"
    read -p "Pressione Enter para sair..."
    exit 1
fi

# ---- Instala dependencias do backend se necessario ----
if ! $PYTHON_CMD -c "import fastapi" >/dev/null 2>&1; then
    echo "Instalando dependencias do backend pela primeira vez, aguarde..."
    $PYTHON_CMD -m pip install fastapi ultralytics pillow onnx onnxruntime "uvicorn[standard]"
fi

# ---- Instala dependencias do frontend se necessario ----
if [ ! -d "$DIR/frontend_projete/node_modules" ]; then
    echo "Instalando dependencias do frontend pela primeira vez, aguarde..."
    (cd "$DIR/frontend_projete" && npm install)
fi

echo "Iniciando backend (FastAPI)..."
echo "Iniciando frontend (React + Vite)..."

if [[ "$OS_TYPE" == MINGW* || "$OS_TYPE" == MSYS* ]]; then
    # Windows via Git Bash: encontra o git-bash.exe e abre janelas dele diretamente
    GITBASH=""
    for CANDIDATE in "/c/Program Files/Git/git-bash.exe" "/c/Program Files (x86)/Git/git-bash.exe"; do
        if [ -f "$CANDIDATE" ]; then
            GITBASH="$CANDIDATE"
            break
        fi
    done

    if [ -z "$GITBASH" ]; then
        echo "[ERRO] Nao encontrei o git-bash.exe nos caminhos padrao."
        echo "Abra o Git Bash manualmente e rode: bash '$DIR/iniciar-projeto.sh'"
        read -p "Pressione Enter para sair..."
        exit 1
    fi

    "$GITBASH" -c "cd '$DIR/IA/API' && $PYTHON_CMD -m uvicorn classificar:app --reload; exec bash" &
    "$GITBASH" -c "cd '$DIR/frontend_projete' && npm run dev; exec bash" &

    sleep 5
    cmd //c start "" "http://127.0.0.1:8000/docs"
    cmd //c start "" "http://localhost:5173"

elif [[ "$OS_TYPE" == "Darwin" ]]; then
    # macOS: abre novas abas do Terminal
    osascript -e "tell application \"Terminal\" to do script \"cd '$DIR/IA/API' && $PYTHON_CMD -m uvicorn classificar:app --reload\""
    osascript -e "tell application \"Terminal\" to do script \"cd '$DIR/frontend_projete' && npm run dev\""

    sleep 5
    open "http://127.0.0.1:8000/docs"
    open "http://localhost:5173"

else
    # Linux: roda em background no mesmo terminal, com logs em arquivo
    (cd "$DIR/IA/API" && $PYTHON_CMD -m uvicorn classificar:app --reload > "$DIR/backend.log" 2>&1 &)
    (cd "$DIR/frontend_projete" && npm run dev > "$DIR/frontend.log" 2>&1 &)

    echo "Backend rodando em segundo plano (log em backend.log)"
    echo "Frontend rodando em segundo plano (log em frontend.log)"

    sleep 5
    xdg-open "http://localhost:5173" >/dev/null 2>&1
fi

echo ""
echo "Pronto! Se o navegador nao abriu sozinho, acesse:"
echo "  Backend:  http://127.0.0.1:8000/docs"
echo "  Frontend: http://localhost:5173"