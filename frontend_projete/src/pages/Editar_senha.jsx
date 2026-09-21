import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AUTH_API_URL } from "../config/api";
import { fetchAutenticado } from "../services/apiAutenticado";
import { mensagemDeErro } from "../services/erros";
import AppBar from "../components/ui/AppBar";
import Button from "../components/ui/Button";
import { PasswordField } from "../components/ui/Field";
import { EmptyState, Notice } from "../components/ui/States";
import { useToast } from "../components/ui/toastContext";

// A cooperativa define a senha de outro usuário (a tela Cooperativa guarda
// o id/nome dele no localStorage antes de navegar para cá).
function EditarSenha() {
  const navigate = useNavigate();
  const toast = useToast();

  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const usuarioId = localStorage.getItem("editarSenhaUsuarioId");
  const usuarioNome = localStorage.getItem("editarSenhaUsuarioNome");

  // ---------- Validação em tempo real ----------
  const senhasPreenchidas = novaSenha.length > 0 && confirmarSenha.length > 0;
  const senhasConferem = novaSenha === confirmarSenha;
  const senhaCurta = novaSenha.length > 0 && novaSenha.length < 6;
  const naoConfere = senhasPreenchidas && !senhasConferem;

  const podeSalvar = senhasPreenchidas && senhasConferem && !senhaCurta && !enviando;

  async function handleSalvarSenha(event) {
    event.preventDefault();
    setErro("");

    if (senhaCurta) {
      setErro("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (!senhasConferem) {
      setErro("As senhas não coincidem.");
      return;
    }

    setEnviando(true);
    try {
      const resposta = await fetchAutenticado(
        `${AUTH_API_URL}/cooperativa/usuario/${usuarioId}/senha`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ senha: novaSenha }),
        }
      );
      const dados = await resposta.json();

      if (resposta.ok) {
        localStorage.removeItem("editarSenhaUsuarioId");
        localStorage.removeItem("editarSenhaUsuarioNome");
        toast.sucesso(
          usuarioNome ? `Senha de ${usuarioNome} atualizada.` : "Senha atualizada com sucesso!"
        );
        navigate("/cooperativa");
      } else {
        setErro(dados.mensagem || "Erro ao atualizar senha.");
      }
    } catch (erroRequisicao) {
      setErro(mensagemDeErro(erroRequisicao, "Erro ao conectar com o servidor."));
    } finally {
      setEnviando(false);
    }
  }

  if (!usuarioId) {
    return (
      <div className="ui-coluna ui-coluna--sem-nav">
        <AppBar titulo="Editar senha" para="/cooperativa" />
        <div className="ui-conteudo">
          <EmptyState
            icone="cadeado"
            titulo="Usuário não identificado"
            texto="Volte para a lista de pessoas e escolha de quem você quer alterar a senha."
          >
            <Button onClick={() => navigate("/cooperativa")}>Voltar para a Cooperativa</Button>
          </EmptyState>
        </div>
      </div>
    );
  }

  return (
    <div className="ui-coluna ui-coluna--sem-nav">
      <AppBar
        titulo="Editar senha"
        subtitulo={usuarioNome ? `Definindo a senha de ${usuarioNome}` : undefined}
        para="/cooperativa"
      />

      <form className="ui-conteudo" onSubmit={handleSalvarSenha} noValidate>
        <div className="ui-cartao ui-formulario">
          <PasswordField
            label="Nova senha"
            name="novaSenha"
            autoComplete="new-password"
            placeholder="Digite a nova senha"
            hint="Use pelo menos 6 caracteres."
            error={senhaCurta ? "A senha precisa ter pelo menos 6 caracteres." : ""}
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
          />

          <PasswordField
            label="Confirmar senha"
            name="confirmarSenha"
            autoComplete="new-password"
            placeholder="Digite a senha novamente"
            error={naoConfere ? "As senhas não coincidem." : ""}
            value={confirmarSenha}
            onChange={(e) => setConfirmarSenha(e.target.value)}
          />

          {senhasPreenchidas && senhasConferem && !senhaCurta && (
            <Notice tipo="sucesso">As senhas coincidem.</Notice>
          )}

          {erro && <Notice tipo="erro">{erro}</Notice>}
        </div>

        <div className="ui-acoes-pagina">
          <Button type="submit" size="lg" block disabled={!podeSalvar} loading={enviando}>
            {enviando ? "Salvando…" : "Salvar nova senha"}
          </Button>
          <Button variant="secondary" block onClick={() => navigate("/cooperativa")}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}

export default EditarSenha;
