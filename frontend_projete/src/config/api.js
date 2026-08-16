// URLs das APIs do projeto, configuráveis por variável de ambiente.
//
// Localmente (npm run dev), se você não definir nada, usa localhost
// (funciona igual antes, sem precisar configurar nada pra testar no PC).
//
// Em produção (Render), essas variáveis precisam ser definidas nas
// configurações do site, ANTES do build (Vite "assa" o valor no código
// durante o build, então mudar depois exige rebuild):
//   VITE_AUTH_API_URL = URL da API Flask (banco_de_dados) no Render
//   VITE_IA_API_URL   = URL da API de IA (classificação) no Render

export const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL || "http://localhost:5000";
export const IA_API_URL = import.meta.env.VITE_IA_API_URL || "http://127.0.0.1:8000";
export const CLIMA_API_URL = import.meta.env.VITE_CLIMA_API_URL || "http://localhost:5001";