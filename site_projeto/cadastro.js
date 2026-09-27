const formulario = document.querySelector('#cadastro-form');
const statusCadastro = document.querySelector('#cadastro-status');
const botao = formulario.querySelector('button[type="submit"]');

formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  if (!formulario.reportValidity()) return;

  const nome = formulario.elements.nome.value.trim();
  const email = formulario.elements.email.value.trim().toLowerCase();
  const senha = formulario.elements.senha.value;
  const confirmaSenha = formulario.elements.confirmaSenha.value;
  statusCadastro.className = 'form-status';

  if (nome.length < 2) {
    statusCadastro.textContent = 'Informe seu nome completo.';
    formulario.elements.nome.focus();
    return;
  }
  if (senha !== confirmaSenha) {
    statusCadastro.textContent = 'As senhas não coincidem.';
    formulario.elements.confirmaSenha.focus();
    return;
  }

  const api = (window.COFFEEVISION_API_URL || '').trim().replace(/\/$/, '');
  if (!api && location.protocol === 'file:') {
    statusCadastro.textContent = 'Abra o site por um servidor e configure a URL da API em config.js.';
    return;
  }

  botao.disabled = true;
  botao.textContent = 'Criando conta…';
  statusCadastro.textContent = '';
  try {
    const resposta = await fetch(`${api}/cadastro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, confirmaNome: nome, email, senha, confirmaSenha }),
    });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      statusCadastro.textContent = dados.mensagem || 'Não foi possível criar a conta. Tente novamente.';
      return;
    }
    formulario.hidden = true;
    document.querySelector('#cadastro-sucesso').hidden = false;
  } catch {
    statusCadastro.textContent = 'Não foi possível conectar à API. Verifique a conexão e tente novamente.';
  } finally {
    botao.disabled = false;
    botao.textContent = 'Criar minha conta';
  }
});
