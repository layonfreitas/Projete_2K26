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
├── frontend_projete/
│   ├── src/
│   │   ├── App.jsx                    # Componente principal
│   │   ├── services/
│   │   │   └── FrontendAPI.js         # Função que envia a imagem para a IA
│   │   └── ...
│   └── package.json
│
└── iniciar-projeto.sh    # Inicia backend + frontend automaticamente (Git Bash/Linux/Mac)
```

---

## ⚙️ Como rodar

O projeto tem duas partes que precisam rodar ao mesmo tempo: a **IA (backend)** e o **frontend**.

Existem duas formas: **automática** (recomendada, Windows) ou **manual** (qualquer sistema).

---

### ✅ Opção 1: Automática — recomendado

1. Abra o terminal (Git Bash) na raiz do projeto.
2. Rode:
   ```bash
   bash iniciar-projeto.sh
   ```
   Se der erro de permissão, rode antes: `chmod +x iniciar-projeto.sh`

O script vai:
- Verificar se você tem Python e Node.js instalados
- Instalar as dependências automaticamente na primeira vez (pode demorar alguns minutos)
- Abrir janelas de terminal separadas: uma com o backend, outra com o frontend
- Abrir o navegador automaticamente nos dois endereços

**Pré-requisitos:** ter [Python 3.10+](https://www.python.org/downloads/) e [Node.js](https://nodejs.org/) instalados, com a opção **"Add to PATH"** marcada durante a instalação.

---

### 🔧 Opção 2: Manual (qualquer sistema operacional)

#### 1. Rodar a IA (Backend)

Acesse a pasta da API:
```
cd IA/API
```

Instale as dependências Python:
```
python -m pip install fastapi ultralytics pillow onnx onnxruntime "uvicorn[standard]"
```

Inicie o servidor:
```
python -m uvicorn classificar:app --reload
```

O servidor vai rodar em: **http://127.0.0.1:8000**

Para testar se está funcionando, acesse no navegador: **http://127.0.0.1:8000/docs**

#### 2. Rodar o Frontend

Abra um **novo terminal** e acesse a pasta do frontend:
```
cd frontend_projete
```

Instale as dependências:
```
npm install
```

Inicie o projeto:
```
npm run dev
```

O frontend vai rodar em: **http://localhost:5173**

---

## 🆘 Solução de problemas

### O terminal do backend "trava" numa linha e não mostra mais nada

Não é travamento — o backend carrega o modelo de IA (`best.onnx`) na inicialização, o que pode levar de alguns segundos a poucos minutos dependendo do PC. Aguarde e teste acessando **http://127.0.0.1:8000/docs** no navegador. Se a página abrir, está funcionando.

### "python não é reconhecido como um comando interno ou externo"

Python não está instalado ou não foi adicionado ao PATH. Reinstale marcando a opção **"Add Python to PATH"**, ou reinicie o computador após instalar.

### "npm não é reconhecido como um comando interno ou externo"

Node.js não está instalado. Baixe em [nodejs.org](https://nodejs.org/) e reinicie o terminal (ou o PC) depois de instalar.

### Erro de porta em uso (`Address already in use` / `port 8000 is already in use`)

Outro programa já está usando a porta 8000 (backend) ou 5173 (frontend). Fechar as janelas de terminal antigas do projeto geralmente resolve. Se persistir, reinicie o PC.

### O navegador abre mas mostra "não é possível acessar este site"

O servidor ainda não terminou de iniciar. Espere mais alguns segundos e atualize a página (F5).

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

## 🛠️ Tecnologias usadas

| Camada       | Tecnologia                  |
| ------------ | ---------------------------- |
| Frontend     | React + Vite                 |
| Backend      | FastAPI (Python)             |
| Modelo de IA | YOLO (Ultralytics) com ONNX  |
| Imagens      | Pillow (PIL)                 |
