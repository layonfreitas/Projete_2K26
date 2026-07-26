import { IA_API_URL } from "../config/api";

const traducoes = {
  "miner": "Bicho mineiro",
  "rust": "Ferrugem",
  "phoma": "Mancha Phoma",
  "cercospora": "Cercosporiose",
};

export async function analisarImagem(arquivo) {
  const formData = new FormData();
  formData.append('imagem', arquivo);

  const response = await fetch(`${IA_API_URL}/classificar/`, {
    method: 'POST',
    body: formData,
  });

  const dados = await response.json();

  if (!dados.resultado || dados.resultado.length === 0) {
    return { doencas: [], mensagem: "Nenhuma doença foi detectada." };
  }

  const doencas = [...new Set(
    dados.resultado.map(item => {
      const chave = item.toLowerCase().trim();
      return traducoes[chave] || null;
    }).filter(Boolean)
  )];

  if (doencas.length === 0) {
    return { doencas: [], mensagem: "Nenhuma doença foi detectada." };
  }

  return { doencas, mensagem: null };
}