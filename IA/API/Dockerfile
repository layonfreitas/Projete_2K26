FROM python:3.11-slim

# Instala o Java, que estava faltando
RUN apt-get update && \
    apt-get install -y --no-install-recommends default-jdk && \
    rm -rf /var/lib/apt/lists/*

ENV JAVA_HOME=/usr/lib/jvm/default-java
ENV PATH="$JAVA_HOME/bin:$PATH"

WORKDIR /app

# Copia e instala as dependencias Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia o resto do seu codigo
COPY . .

# Comando que inicia sua aplicacao (ajuste o nome do arquivo se necessario)
CMD uvicorn CLMI_clf:app --host 0.0.0.0 --port $PORT