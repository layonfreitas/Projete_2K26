// Wrapper fino em volta do fetch que já manda o X-Usuario-Id
// (usado pelo backend pra checar o papel/tipo de quem está chamando —
// ver banco_de_dados/routes/auth_utils.py).
//
// Uso: em vez de fetch(url, opcoes), use fetchAutenticado(url, opcoes).

export function fetchAutenticado(url, opcoes = {}) {
  const usuarioId = localStorage.getItem("usuarioId");

  return fetch(url, {
    ...opcoes,
    headers: {
      ...(opcoes.headers || {}),
      ...(usuarioId ? { "X-Usuario-Id": usuarioId } : {}),
    },
  });
}