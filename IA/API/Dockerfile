# Imagem base leve do Python
FROM python:3.11-slim

WORKDIR /app

# Copia primeiro só o requirements.txt (aproveita cache do Docker:
# se o código mudar mas as dependências não, não reinstala tudo de novo)
COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Copia o resto do código da API (classificar.py, best.onnx, etc.)
COPY . .

# O Cloud Run injeta a porta certa pela variável de ambiente PORT
# (por padrão 8080). --host 0.0.0.0 é obrigatório: sem isso o Cloud
# Run não consegue alcançar o servidor de fora do container.
ENV PORT=8080
EXPOSE 8080

CMD ["sh", "-c", "uvicorn classificar:app --host 0.0.0.0 --port $PORT"]
