# Alterações desta versão

## 1. Fila de espera + execução diária (backend_indices/backend_server.py)
- Quando o serviço está ocupado, o pedido **entra na fila** (antes dava erro 409). Um worker processa um por vez.
- Pedidos repetidos da mesma lavoura não duplicam na fila.
- `GET /fila/` mostra o que está rodando, quem está esperando e a última execução diária.
- **Execução diária automática** dentro do próprio servidor (sem GitHub Actions, sem cron):
  roda todo dia às 06:00 (horário de Brasília). Se o computador estava desligado nessa hora,
  roda assim que o servidor voltar (se ainda não rodou no dia).
  A data da última execução fica em `backend_indices/ultima_execucao_diaria.txt`.
- Variáveis opcionais no `.env` do backend_indices:
  - `PROCESSAMENTO_DIARIO_HORA=06:00` (formato HH:MM)
  - `AGENDAMENTO_FUSO=America/Sao_Paulo`
  - `AGENDADOR_ATIVO=1` (use `0` para desligar)
  - `DAY_MAPS_ESPERA_SEGUNDOS=300`
- IMPORTANTE: rode o uvicorn com **um único worker** (não use `--workers 2`), senão haveria duas filas.
  Exemplo: `uvicorn backend_server:app --host 0.0.0.0 --port 8001`

## 2. URL do link da lavoura (e-mails de alerta)
O link vem da variável `FRONTEND_URL` do **banco_de_dados/.env**:

    FRONTEND_URL=https://coffeevison.projete2k26.workers.dev

(sem barra no final). Reinicie o Flask depois de mudar. O CORS do `app.py` já aceita essa URL.

## 3. Imagem do mapa
Os mapas NDVI/NDRE/NDWI agora são exportados com reamostragem bilinear (antes: blocos de 10 m).
Vale só para imagens novas; as já salvas continuam como estavam até serem reprocessadas.

## 4. Cadastro da lavoura (frontend)
Avisos específicos por campo (qual safra, qual data, qual conflito), foco automático no primeiro erro,
mensagens diferentes para sessão expirada, timeout, conexão caída, erro do servidor e fila de espera.

## 5. Histórico > Alertas (frontend)
Mensagens por índice e nível, data da imagem, agrupamento por dia, painel "O que fazer".
Alertas sem mapa (CLMI) escondem o mapa e mostram só o painel de detalhes.
Erros de rede/servidor fora do ar agora aparecem em português claro.
