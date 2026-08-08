# ☕ CoffeeVision

Plataforma para pequenos produtores de café monitorarem a saúde da lavoura, unindo **classificação de doenças em folhas por visão computacional (YOLO)**, **índices de vegetação via satélite (Google Earth Engine / Sentinel-2)** e **dados climáticos em tempo real**, tudo em um só lugar.

O produtor cadastra a lavoura no mapa, acompanha o clima do local, tira uma foto da folha para diagnóstico rápido e, no futuro, recebe alertas com base nos índices de vegetação — sem depender de tecnologias caras de agricultura de precisão.

---

## 🔗 Como as partes se conectam

```
┌─────────────────────┐
│   Frontend (React)  │  → cadastro de lavoura no mapa, upload de foto,
│  localhost:5173      │     clima do local, autenticação
└──────────┬───────────┘
           │
           ├──► IA/API (FastAPI + YOLO/ONNX) ......... classifica a doença na foto da folha
           │      localhost:8000
           │
           ├──► banco_de_dados (Flask + MySQL) ........ login, cadastro, lavouras, recuperação de senha
           │      localhost:5000
           │
           ├──► backend_clima (Node/Express) .......... consulta o OpenWeatherMap
           │      localhost:5001
           │
           └──► backend_indices (FastAPI + Earth Engine) . NDVI/NDRE/NDWI da lavoura via satélite
                  (uso via script/API própria, não conectado ao frontend ainda)
```

São **quatro serviços de backend independentes** rodando ao mesmo tempo, mais o frontend. Cada um cuida de uma parte do problema.

---

## 📁 Estrutura do Projeto

```
Projete_2K26/
├── IA/API/                    # Classificação de doenças na folha (FastAPI + YOLO exportado em ONNX)
│   ├── classificar.py         # Servidor: recebe a foto, roda o modelo, devolve as doenças detectadas
│   ├── best.onnx               # Modelo treinado (Cercospora, Bicho-mineiro, Phoma, Ferrugem)
│   ├── index.html / teste.js  # Página simples pra testar o endpoint sem precisar do frontend
│   └── requirements.txt
│
├── banco_de_dados/            # Autenticação, cadastro e persistência (Flask + MySQL)
│   ├── app.py                  # Servidor principal, registra as rotas
│   ├── config.py               # Configuração de conexão com o banco (variáveis de ambiente)
│   ├── database/schema.sql     # Estrutura das tabelas (usuarios, lavouras)
│   └── routes/
│       ├── auth_routes.py      # /cadastro, /login
│       ├── lavoura_routes.py   # /lavoura (criar/listar lavouras do usuário)
│       └── senha_routes.py     # /senha/recuperar (código por e-mail via Brevo), /senha/trocar
│
├── backend_clima/              # Consulta de clima (Node.js + Express)
│   └── server.js                # GET /clima?lat=..&lon=.. → consulta o OpenWeatherMap
│
├── backend_indices/             # Índices de vegetação via satélite (FastAPI + Google Earth Engine)
│   ├── backend_server.py        # POST /day_maps, POST /get_zona_de_manejo
│   ├── get_indices.py           # Calcula NDVI, NDRE, NDWI a partir de imagens Sentinel-2
│   ├── z_score.py                # Mapa de anomalia (desvio em relação ao histórico da área)
│   └── serie_temporal.py         # Série temporal por zona de manejo
│
├── frontend_projete/            # Interface (React + Vite)
│   └── src/
│       ├── pages/
│       │   ├── login.jsx / Cadastro.jsx
│       │   ├── RecuperarSenha.jsx / TrocarSenha.jsx
│       │   ├── home.jsx          # Upload de foto + diagnóstico + clima + lavouras cadastradas
│       │   ├── mapa.jsx           # Desenho do contorno da lavoura no mapa (Leaflet)
│       │   ├── perfil.jsx
│       │   └── agronomo.jsx       # Em desenvolvimento — ainda não conectada nas rotas do app
│       ├── components/            # Header, BottomNav, UploadCard, ResultCard, ClimaBanner...
│       ├── services/
│       │   ├── FrontendAPI.js     # Fala com a IA/API (classificação)
│       │   └── climaAPI.js        # Fala com o backend_clima
│       └── config/api.js          # URLs dos backends (local ou produção, via .env)
│
└── iniciar.sh                    # Sobe automaticamente a IA/API + o frontend (Git Bash/Linux/macOS)
```

---

## ⚙️ Como rodar

O projeto tem **4 backends + 1 frontend**. Nem todos são obrigatórios para testar: se você só quer ver o diagnóstico de doenças funcionando, basta a IA/API + o frontend. Para o fluxo completo (login, cadastro de lavoura, clima), rode também o `banco_de_dados` e o `backend_clima`.

| Serviço | Obrigatório para... | Porta padrão |
|---|---|---|
| `IA/API` | Diagnóstico de doenças por foto | 8000 |
| `banco_de_dados` | Login, cadastro, salvar lavouras | 5000 |
| `backend_clima` | Exibir o clima na tela inicial | 5001 |
| `backend_indices` | Índices de vegetação via satélite (uso avançado/experimental) | — |
| `frontend_projete` | Interface | 5173 |

### ✅ Opção rápida — IA + Frontend (script automático)

```bash
bash iniciar.sh
```
Se der erro de permissão: `chmod +x iniciar.sh` antes. O script confere se você tem Python e Node.js, instala as dependências na primeira vez e abre a IA/API e o frontend automaticamente. **Ele não sobe o `banco_de_dados` nem o `backend_clima`** — para testar login/cadastro/clima, siga a opção manual abaixo também para esses dois serviços.

**Pré-requisitos:** [Python 3.10+](https://www.python.org/downloads/) e [Node.js](https://nodejs.org/), com "Add to PATH" marcado na instalação.

### 🔧 Opção manual (todos os serviços)

#### 1. IA/API — diagnóstico de doenças
```bash
cd IA/API
python -m pip install -r requirements.txt
python -m uvicorn classificar:app --reload
```
Roda em **http://127.0.0.1:8000** — teste em `/docs`.

#### 2. banco_de_dados — login, cadastro e lavouras
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
```
Rode o script `database/schema.sql` no seu MySQL antes de iniciar. Depois:
```bash
python app.py
```
Roda em **http://127.0.0.1:5000**.

#### 3. backend_clima — dados climáticos
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

#### 4. backend_indices — índices de vegetação (opcional/experimental)
```bash
cd backend_indices
python -m pip install fastapi uvicorn earthengine-api google-auth pydantic
python -m uvicorn backend_server:app --reload
```
Requer autenticação configurada com o Google Earth Engine (`google.auth.default()`) e acesso ao projeto `projete2k26` no GEE. Ainda não está conectado ao frontend — hoje é consumido via chamadas diretas à API.

#### 5. Frontend
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

---

## 🆘 Solução de problemas

**O terminal da IA/API "trava" numa linha e não mostra mais nada**
Não travou — está carregando o modelo (`best.onnx`) na inicialização. Aguarde e acesse `http://127.0.0.1:8000/docs`.

**`python`/`npm` não é reconhecido como comando**
Python ou Node.js não estão no PATH. Reinstale marcando "Add to PATH" ou reinicie o terminal/PC.

**Erro de porta em uso**
Feche janelas de terminal antigas do projeto. As portas usadas são 8000 (IA), 5000 (banco), 5001 (clima) e 5173 (frontend).

**Erro de conexão com o MySQL / certificado SSL**
Se estiver usando um banco em nuvem (ex: Aiven), confirme que `DB_SSL_CA` (caminho do `.pem`) ou `DB_SSL_CA_B64` está definido no `.env` de `banco_de_dados`.

---

## 🌐 Servidores online (Render)

A IA de classificação também está hospedada em:
```
https://projete-2k26.onrender.com/classificar/
```
> ⚠️ No plano gratuito do Render, o servidor "dorme" após inatividade — a primeira requisição pode levar 1-2 minutos.

Para usar os serviços online em vez dos locais, defina as variáveis `VITE_*` (veja seção "Frontend" acima) em vez de editar URLs direto no código.

---

## 🔗 Como funciona o diagnóstico por foto

1. O produtor escolhe/tira uma foto da folha na tela inicial.
2. O frontend envia a imagem para a IA/API via `FrontendAPI.js`.
3. O modelo YOLO (rodando via ONNX Runtime) detecta e classifica a(s) doença(s) presentes.
4. O resultado volta traduzido para o produtor (ex: `"Rust"` → **Ferrugem**, `"Miner"` → **Bicho mineiro**).

Doenças reconhecidas hoje: **Ferrugem**, **Bicho mineiro**, **Mancha Phoma**, **Cercosporiose**.

Exemplo de resposta da IA:
```json
{ "resultado": ["Rust", "Phoma"] }
```
Se nenhuma doença for detectada:
```json
{ "resultado": [] }
```

---

## 🛠️ Tecnologias usadas

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + Vite + React Router + Leaflet |
| IA (diagnóstico por foto) | YOLO (Ultralytics), exportado em ONNX + FastAPI |
| Autenticação e dados | Flask + MySQL + bcrypt + Brevo (e-mail) |
| Clima | Node.js + Express + OpenWeatherMap |
| Índices de vegetação | Google Earth Engine + Sentinel-2 + FastAPI |

---

## 👥 Equipe

Cauã Eduardo Silva · Layon Rubens Motta de Freitas · Thiago Pereira da Costa · Marcos José de Souza Filho
