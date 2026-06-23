# ☕ Coffee Vision

Sistema de classificação de doenças em folhas de café usando visão computacional com YOLO.

---

## 📁 Estrutura do Projeto

```
Projete_2K26/
├── IA/
│   └── API/
│       ├── classificar.py   # Servidor FastAPI com o modelo YOLO
│       ├── best.onnx        # Modelo treinado
│       ├── index.html       # Página de teste simples
│       └── teste.js         # JS do teste
│
└── frontend_projete/
    ├── src/
    │   ├── App.jsx                    # Componente principal
    │   ├── services/
    │   │   └── FrontendAPI.js         # Função que envia a imagem para a IA
    │   └── ...
    └── package.json
```

---

## ⚙️ Como rodar

O projeto tem duas partes que precisam rodar ao mesmo tempo: a **IA (backend)** e o **frontend**.

---

### 1. Rodar a IA (Backend)

Acesse a pasta da API:

```bash
cd IA/API
```

Instale as dependências Python:

```bash
python -m pip install fastapi ultralytics pillow onnx onnxruntime "uvicorn[standard]"
```

Inicie o servidor:

```bash
python -m uvicorn classificar:app --reload
```

O servidor vai rodar em: **http://127.0.0.1:8000**

Para testar se está funcionando, acesse no navegador: http://127.0.0.1:8000/docs

---

### 2. Rodar o Frontend

Abra um **novo terminal** e acesse a pasta do frontend:

```bash
cd frontend_projete
```

Instale as dependências:

```bash
npm install
```

Inicie o projeto:

```bash
npm run dev
```

O frontend vai rodar em: **http://localhost:5173**

---

## 🔗 Como funciona

1. O usuário escolhe uma foto de uma folha de café no frontend
2. Ao clicar em **"Analisar imagem"**, o frontend envia a foto para a IA via `FrontendAPI.js`
3. A IA processa a imagem com o modelo YOLO e retorna as doenças detectadas
4. O frontend exibe o resultado na tela

### Exemplo de resposta da IA:

```json
{
  "resultado": ["Rust", "Phoma"]
}
```

Se nenhuma doença for detectada, retorna:

```json
{
  "resultado": []
}
```

---

## 🌐 Servidor online (Render)

A IA também está hospedada online em:

```
https://projete-2k26.onrender.com/classificar/
```

> ⚠️ No plano gratuito do Render, o servidor "dorme" após inatividade. A primeira requisição pode demorar 1-2 minutos para acordar. As próximas serão rápidas.

Para usar o servidor online em vez do local, edite o arquivo `src/services/FrontendAPI.js` e troque a URL:

```js
// Local
const response = await fetch('http://127.0.0.1:8000/classificar/', ...);

// Online
const response = await fetch('https://projete-2k26.onrender.com/classificar/', ...);
```

---

## 🛠️ Tecnologias usadas

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React + Vite |
| Backend | FastAPI (Python) |
| Modelo de IA | YOLO (Ultralytics) com ONNX |
| Imagens | Pillow (PIL) |