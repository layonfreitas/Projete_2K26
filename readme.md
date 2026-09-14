# ☕ CoffeeVision

Plataforma para **pequenos produtores de café** monitorarem a saúde da lavoura de forma simples e acessível, unindo:

- 🔬 **Diagnóstico de doenças em folhas** por visão computacional (YOLO/ONNX)
- 🛰️ **Índices de vegetação via satélite** (Google Earth Engine / Sentinel-2 — NDVI, NDRE, NDWI)
- 🌦️ **Dados climáticos em tempo real**
- 🗺️ **Cadastro e acompanhamento da lavoura em mapa**
- 👥 **Fluxo com múltiplos perfis**: produtor, agrônomo e cooperativa

Tudo em um só lugar — sem depender das tecnologias caras de agricultura de precisão que hoje só grandes propriedades conseguem pagar.

---

## 🎯 Problema

Pequenos produtores geralmente não têm acesso a tecnologias avançadas de agricultura de precisão. Problemas como estresse hídrico, doenças e condições climáticas desfavoráveis costumam ser percebidos tarde demais, causando perdas na produção.

## 💡 Solução

O CoffeeVision reúne clima, dados da lavoura, imagens de folhas e índices de satélite em um único painel, e traduz esses dados técnicos em **alertas e informações práticas** para apoiar a decisão do produtor — que continua sendo o responsável final pelas decisões no campo.

---

## 👥 Perfis de usuário

| Perfil | O que faz |
|---|---|
| **Produtor** | Cadastra a lavoura no mapa, acompanha clima e índices, tira foto da folha para diagnóstico, registra observações |
| **Agrônomo** | Vincula-se a produtores, acompanha as lavouras vinculadas, registra laudos/observações técnicas |
| **Cooperativa** | Cadastra/gerencia usuários (produtores e agrônomos), acompanha dashboard geral, ranking de agrônomos, envia avisos e exporta relatórios |

---

## 🔗 Como as partes se conectam

```
┌───────────────────────┐
│   Frontend (React)     │  cadastro de lavoura no mapa, upload de foto,
│   localhost:5173        │  clima, histórico, laudos, painéis por perfil
└───────────┬─────────────┘
            │
            ├──► IA/API (FastAPI + YOLO/ONNX) ........... classifica doenças na foto da folha
            │      localhost:8000
            │
            ├──► banco_de_dados (Flask + MySQL) .......... login, cadastro, lavouras, vínculos,
            │      localhost:5000                          observações, imagens, avisos, laudos
            │
            ├──► backend_clima (Node/Express) ............ consulta o OpenWeatherMap
            │      localhost:5001
            │
            └──► backend_indices (FastAPI + Earth Engine) . NDVI/NDRE/NDWI e zonas de manejo
                   (chamado pelo banco_de_dados/processamento em lote, via Earth Engine)
```

São **quatro serviços de backend independentes**, mais o frontend. Cada um cuida de uma parte do problema.

---

## 📁 Estrutura do projeto

```
Projete_2K26/
├── IA/API/                     # Diagnóstico de doenças na folha (FastAPI + YOLO exportado em ONNX)
│   ├── classificar.py           # POST /classificar/ — recebe a foto, roda o modelo, devolve as doenças
│   ├── best.onnx                 # Modelo treinado (Cercospora, Bicho-mineiro, Phoma, Ferrugem)
│   ├── index.html / teste.js    # Página simples para testar o endpoint sem o frontend
│   └── requirements.txt
│
├── banco_de_dados/              # Autenticação, cadastro e persistência (Flask + MySQL)
│   ├── app.py                    # Servidor principal, registra os blueprints
│   ├── config.py                 # Conexão com o banco (variáveis de ambiente + SSL/CA)
│   ├── database/schema.sql       # usuarios, lavouras, vinculos_agronomo, observacoes,
│   │                              # imagens, indices_vegetacao, avisos, log_auditoria
│   ├── Procfile                  # Deploy no Render (gunicorn)
│   └── routes/
│       ├── auth_routes.py         # /cadastro, /login, /produtores, /observacoes
│       ├── lavoura_routes.py      # /lavoura, /lavouras, /laudo/enviar_email
│       ├── senha_routes.py        # /senha/recuperar/solicitar|confirmar, /senha/trocar
│       ├── agronomo_routes.py     # /vincular, /agronomo/<id>/produtores
│       ├── cooperativa_routes.py  # /cooperativa/* (usuários, dashboard, ranking, avisos, relatório.csv)
│       ├── imagens_routes.py      # /imagens, /acessar_imagem, /get_i_valor
│       └── indices_routes.py      # /indices_vegetacao
│
├── backend_clima/               # Consulta de clima (Node.js + Express)
│   └── server.js                  # GET /clima?lat=..&lon=.. → OpenWeatherMap
│
├── backend_indices/              # Índices de vegetação via satélite (FastAPI + Google Earth Engine)
│   ├── backend_server.py          # /health, /day_maps/, /processar_todas_lavouras/, /get_zona_de_manejo/
│   ├── get_indices.py             # Calcula NDVI, NDRE, NDWI a partir de imagens Sentinel-2
│   ├── z_score.py                 # Mapa de anomalia (desvio em relação ao histórico da área)
│   ├── serie_temporal.py          # Série temporal por zona de manejo
│   ├── processar_lavouras.py      # Processamento em lote das lavouras cadastradas
│   └── gee_auth.py                # Autenticação com o Google Earth Engine
│
├── frontend_projete/             # Interface (React 19 + Vite)
│   └── src/
│       ├── pages/
│       │   ├── login.jsx / Cadastro.jsx
│       │   ├── RecuperarSenha.jsx / TrocarSenha.jsx / Editar_senha.jsx
│       │   ├── home.jsx            # Upload de foto + diagnóstico + clima + lavouras cadastradas
│       │   ├── mapa.jsx             # Desenho do contorno da lavoura no mapa (Leaflet)
│       │   ├── historico.jsx / historicoMapas.jsx
│       │   ├── observacao.jsx / observacao_produtor.jsx / edicao.jsx / laudo.jsx
│       │   ├── perfil.jsx
│       │   ├── agronomo.jsx         # Painel do agrônomo
│       │   └── cooperativa.jsx      # Painel da cooperativa
│       ├── components/              # Header, BottomNav, UploadCard, ResultCard, ClimaBanner,
│       │                            # AvisosBanner, NotificationBell, RotaProtegida...
│       ├── services/                # FrontendAPI.js, climaAPI.js, historicoAPI.js, apiAutenticado.js
│       └── config/api.js            # URLs dos backends (local ou produção, via .env)
│
└── README.md
```

---

## ⚙️ Como rodar

O projeto tem **4 backends + 1 frontend**. Nem todos são obrigatórios para testar: se você só quer ver o diagnóstico de doenças funcionando, basta a `IA/API` + o `frontend_projete`. Para o fluxo completo (login, cadastro de lavoura, clima, painéis), rode também `banco_de_dados` e `backend_clima`.

| Serviço | Obrigatório para... | Porta padrão |
|---|---|---|
| `IA/API` | Diagnóstico de doenças por foto | 8000 |
| `banco_de_dados` | Login, cadastro, lavouras, painéis, laudos, avisos | 5000 |
| `backend_clima` | Exibir o clima na tela inicial | 5001 |
| `backend_indices` | Índices de vegetação via satélite (Earth Engine) | 8001* |
| `frontend_projete` | Interface | 5173 |

\* `backend_indices` não define porta fixa no código — rode com `--port` na mão (veja abaixo).

**Pré-requisitos:** [Python 3.10+](https://www.python.org/downloads/) e [Node.js](https://nodejs.org/), com "Add to PATH" marcado na instalação, além de acesso a um banco **MySQL**.

### 1. IA/API — diagnóstico de doenças

```bash
cd IA/API
python -m pip install -r requirements.txt
python -m uvicorn classificar:app --reload
```
Roda em **http://127.0.0.1:8000** — teste em `/docs`.

### 2. banco_de_dados — login, cadastro, lavouras e painéis

```bash
cd banco_de_dados
python -m pip install -r requirements.txt
```
Crie um arquivo `.env` nessa pasta com:
```
DB_HOST=...
DB_USER=...
DB_PASSWORD=...
DB_NAME=coffeeVision
DB_PORT=3306
BREVO_API_KEY=...
BREVO_EMAIL_REMETENTE=...
# opcional, apenas se o banco exigir SSL (ex: Aiven)
DB_SSL_CA=./aiven-ca.pem
```
Rode o script `database/schema.sql` no seu MySQL antes de iniciar (cria `usuarios`, `lavouras`, `vinculos_agronomo`, `observacoes`, `imagens`, `indices_vegetacao`, `avisos` e `log_auditoria`). Depois:
```bash
python app.py
```
Roda em **http://127.0.0.1:5000**. Em produção, o `Procfile` já está pronto para `gunicorn app:app`.

### 3. backend_clima — dados climáticos

```bash
cd backend_clima
npm install
```
Crie um `.env` nessa pasta com:
```
OPENWEATHER_API_KEY=...
PORT=5001
```
```bash
npm start
```
Roda em **http://localhost:5001**.

### 4. backend_indices — índices de vegetação (Earth Engine)

```bash
cd backend_indices
python -m pip install -r requirements.txt
python -m uvicorn backend_server:app --reload --port 8001
```
Requer autenticação com o Google Earth Engine — configure `GOOGLE_CREDENTIALS_JSON_B64` (uma service account em base64, usada em produção) ou credenciais padrão do `gcloud` localmente, além de acesso ao projeto `projete2k26` no GEE (ou defina `EE_PROJECT` com outro projeto). Endpoints principais: `/health`, `/day_maps/`, `/processar_todas_lavouras/` e `/get_zona_de_manejo/`.

### 5. Frontend

```bash
cd frontend_projete
npm install
npm run dev
```
Roda em **http://localhost:5173**.

Por padrão o frontend aponta para `localhost` em todas as portas acima. Para apontar para os serviços já hospedados (produção), crie um `.env` em `frontend_projete/` com:
```
VITE_AUTH_API_URL=https://sua-api-auth.onrender.com
VITE_IA_API_URL=https://sua-api-ia.onrender.com
VITE_CLIMA_API_URL=https://sua-api-clima.onrender.com
```
⚠️ O Vite "assa" essas variáveis no código durante o build — mudá-las depois exige rebuild.

---

## 🔗 Como funciona o diagnóstico por foto

1. O produtor escolhe/tira uma foto da folha na tela inicial.
2. O frontend envia a imagem para a `IA/API` via `FrontendAPI.js`.
3. O modelo YOLO (rodando via ONNX Runtime) detecta e classifica a(s) doença(s) presentes.
4. O resultado volta traduzido para o produtor (ex.: `"Rust"` → **Ferrugem**, `"Miner"` → **Bicho-mineiro**).

Doenças reconhecidas hoje: **Ferrugem**, **Bicho-mineiro**, **Mancha Phoma**, **Cercosporiose**.

Exemplo de resposta da IA:
```json
{ "resultado": ["Rust", "Phoma"] }
```
Se nenhuma doença for detectada:
```json
{ "resultado": [] }
```

---

## 🆘 Solução de problemas

**O terminal da `IA/API` "trava" numa linha e não mostra mais nada**
Não travou — está carregando o modelo (`best.onnx`) na inicialização. Aguarde e acesse `http://127.0.0.1:8000/docs`.

**`python`/`npm` não é reconhecido como comando**
Python ou Node.js não estão no PATH. Reinstale marcando "Add to PATH" ou reinicie o terminal/PC.

**Erro de porta em uso**
Feche janelas de terminal antigas do projeto. As portas usadas são 8000 (IA), 5000 (banco), 5001 (clima) e 5173 (frontend).

**Erro de conexão com o MySQL / certificado SSL**
Se estiver usando um banco em nuvem (ex.: Aiven), confirme que `DB_SSL_CA` (caminho do `.pem`) ou `DB_SSL_CA_B64` está definido no `.env` de `banco_de_dados`.

**Erro de autenticação no `backend_indices`**
Confirme que `GOOGLE_CREDENTIALS_JSON_B64` (ou as credenciais padrão do `gcloud`) estão configuradas e que a conta tem acesso ao projeto do Earth Engine.

---

## 🚀 Próximos passos

- Conectar totalmente os índices de vegetação (`backend_indices`) aos alertas mostrados ao produtor
- Uso de Machine Learning para recomendações mais precisas (ex.: modelos treinados no Weka)
- Funcionamento offline mais completo
- Expandir o histórico e os relatórios em PDF/CSV para agrônomos e cooperativas

---

## 🛠️ Tecnologias usadas

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + Vite + React Router + Leaflet/React-Leaflet + jsPDF/html2canvas |
| IA (diagnóstico por foto) | YOLO (Ultralytics), exportado em ONNX + FastAPI + ONNX Runtime |
| Autenticação e dados | Flask + MySQL + bcrypt + Brevo (e-mail) + gunicorn (deploy) |
| Clima | Node.js + Express + OpenWeatherMap |
| Índices de vegetação | Google Earth Engine + Sentinel-2 + FastAPI + geemap/scikit-fuzzy |

---

## 👥 Equipe

Cauã Eduardo Silva · Layon Rubens Motta de Freitas · Thiago Pereira da Costa · Marcos José de Souza Filho
