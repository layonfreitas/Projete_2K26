export async function analisarImagem(arquivo) {
  const formData = new FormData();
  formData.append('imagem', arquivo);

  const response = await fetch('http://127.0.0.1:8000/classificar/', {
    method: 'POST',
    body: formData,
  });

  return await response.json();
}