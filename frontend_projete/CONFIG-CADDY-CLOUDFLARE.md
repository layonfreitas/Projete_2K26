# Configuração para Caddy + Cloudflare Tunnel

Esta pasta usa o frontend da versão (1), com as configurações de acesso da versão (3).

Rotas esperadas pelo frontend:
- `/api` -> API principal / Flask
- `/ia` -> API de IA
- `/clima` -> API de clima
- `/indices` -> API de índices

O arquivo `vite.config.js` também permite hosts `*.trycloudflare.com` durante o desenvolvimento com Vite.

Importante: o Caddyfile deve fazer o reverse proxy dessas rotas para os serviços correspondentes.
