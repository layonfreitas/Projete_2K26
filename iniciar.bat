@echo off
title Coffee Vision - Launcher
echo ==========================================
echo   Iniciando Coffee Vision (Backend + Frontend)
echo ==========================================
echo.

REM Descobre automaticamente a pasta onde este .bat esta localizado
set PROJETO=%~dp0
REM Remove a barra final do caminho
set PROJETO=%PROJETO:~0,-1%

REM ---- Verifica se Python esta instalado ----
where python >nul 2>nul
if errorlevel 1 (
    echo [ERRO] Python nao encontrado. Instale em https://www.python.org/downloads/
    echo Marque a opcao "Add Python to PATH" durante a instalacao.
    pause
    exit /b
)

REM ---- Verifica se Node/npm esta instalado ----
where npm >nul 2>nul
if errorlevel 1 (
    echo [ERRO] Node.js/npm nao encontrado. Instale em https://nodejs.org/
    pause
    exit /b
)

REM ---- Verifica se as dependencias do backend estao instaladas ----
python -c "import fastapi" >nul 2>nul
if errorlevel 1 (
    echo Instalando dependencias do backend pela primeira vez, aguarde...
    python -m pip install fastapi ultralytics pillow onnx onnxruntime "uvicorn[standard]"
)

REM ---- Verifica se as dependencias do frontend estao instaladas ----
if not exist "%PROJETO%\frontend_projete\node_modules" (
    echo Instalando dependencias do frontend pela primeira vez, aguarde...
    pushd "%PROJETO%\frontend_projete"
    call npm install
    popd
)

echo Iniciando backend (FastAPI)...
start "Coffee Vision - Backend" cmd /k "cd /d %PROJETO%\IA\API && python -m uvicorn classificar:app --reload"

echo Iniciando frontend (React + Vite)...
start "Coffee Vision - Frontend" cmd /k "cd /d %PROJETO%\frontend_projete && npm run dev"

echo.
echo Aguardando os servidores iniciarem...
timeout /t 5 /nobreak >nul

echo Abrindo no navegador...
start http://127.0.0.1:8000/docs
start http://localhost:5173

exit