// Tudo que o app guarda no localStorage sobre a sessão fica listado aqui,
// para que "Sair" limpe tudo (antes sobravam usuarioTipo, lavouraId,
// produtorSelecionado* etc. da conta anterior).

const CHAVES_SESSAO = [
  "autenticado",
  "usuarioId",
  "usuarioNome",
  "usuarioEmail",
  "usuarioTipo",
  "produtorSelecionadoId",
  "produtorSelecionadoNome",
  "lavouraId",
  "lavouraNome",
  "editarSenhaUsuarioId",
  "editarSenhaUsuarioNome",
];

export function encerrarSessao() {
  CHAVES_SESSAO.forEach((chave) => localStorage.removeItem(chave));
  try {
    sessionStorage.clear();
  } catch {
    /* sem sessionStorage: nada a limpar */
  }
}

export function lerSessao() {
  return {
    id: localStorage.getItem("usuarioId"),
    nome: localStorage.getItem("usuarioNome"),
    email: localStorage.getItem("usuarioEmail"),
    tipo: localStorage.getItem("usuarioTipo"),
  };
}
