FROM python:3.11-slim

# Instala o Java necessário para o Weka.
RUN apt-get update && \
    apt-get install -y --no-install-recommends default-jdk && \
    rm -rf /var/lib/apt/lists/*

ENV JAVA_HOME=/usr/lib/jvm/default-java
ENV PATH="${JAVA_HOME}/bin:${PATH}"

WORKDIR /app

COPY IA/API/requirements.txt /app/IA/API/requirements.txt

RUN pip install --no-cache-dir -r /app/IA/API/requirements.txt

# Preserva a estrutura usada pelo app.py para localizar gee_auth.
COPY IA/API/ /app/IA/API/
COPY backend_indices/ /app/backend_indices/

WORKDIR /app/IA/API

CMD ["sh", "-c", "exec uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}"]