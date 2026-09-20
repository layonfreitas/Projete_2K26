// Traduz erros técnicos (ex.: "Failed to fetch") em texto que o usuário entende.
export function mensagemDeErro(erro, padrao = "Algo deu errado. Tente novamente.") {
  if (erro?.name === "TypeError") {
    return "Não foi possível conectar ao servidor. Verifique sua internet e tente de novo.";
  }
  return erro?.message || padrao;
}
