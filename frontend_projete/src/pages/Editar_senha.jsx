import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AUTH_API_URL } from "../config/api";
import { fetchAutenticado } from "../services/apiAutenticado";
import "./Editar_senha.css";
import BottomNav from "../components/BottomNav";

function editar_senha() {
  const navigate = useNavigate();

  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  // Pega o id do usuário sendo editado (setado antes de navegar pra cá)
  const usuarioId = localStorage.getItem("editarSenhaUsuarioId");

  // ---------- Validação em tempo real ----------
  const senhasPreenchidas = novaSenha.length > 0 && confirmarSenha.length > 0;
  const senhasConferem = novaSenha === confirmarSenha;
  const senhaCurta = novaSenha.length > 0 && novaSenha.length < 6;

  let statusConfirmacao = null;
  if (senhasPreenchidas) {
    statusConfirmacao = senhasConferem ? "ok" : "erro";
  }

  const podeSalvar =
    senhasPreenchidas && senhasConferem && !senhaCurta && !enviando;

  async function handleSalvarSenha(event) {
    event.preventDefault();
    setMensagem("");

    if (senhaCurta) {
      setMensagem("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (!senhasConferem) {
      setMensagem("As senhas não coincidem.");
      return;
    }
    if (!usuarioId) {
      setMensagem("Usuário não identificado. Volte e tente novamente.");
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
        setMensagem("Senha atualizada com sucesso!");
        localStorage.removeItem("editarSenhaUsuarioId");
        setNovaSenha("");
        setConfirmarSenha("");
        setTimeout(() => navigate("/cooperativa"), 1200);
      } else {
        setMensagem(dados.mensagem || "Erro ao atualizar senha.");
      }
    } catch (erroRequisicao) {
      setMensagem("Erro ao conectar com o servidor.");
      console.error(erroRequisicao);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="perfil-page">
      <div className="perfil-card">
        <div className="perfil-header-gradient"></div>

        <h1>Editar senha</h1>

        <form className="editar-senha-form" onSubmit={handleSalvarSenha}>
          <label htmlFor="novaSenha">Nova senha</label>
          <input
            id="novaSenha"
            type="password"
            placeholder="Digite a nova senha"
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            required
          />

          <label htmlFor="confirmarSenha">Confirmar senha</label>
          <input
            id="confirmarSenha"
            type="password"
            placeholder="Digite a senha novamente"
            value={confirmarSenha}
            onChange={(e) => setConfirmarSenha(e.target.value)}
            className={
              statusConfirmacao === "ok"
                ? "editar-senha-input-ok"
                : statusConfirmacao === "erro"
                ? "editar-senha-input-erro"
                : ""
            }
            required
          />

          {statusConfirmacao === "erro" && (
            <span className="editar-senha-feedback editar-senha-feedback-erro">
              As senhas não coincidem.
            </span>
          )}
          {statusConfirmacao === "ok" && (
            <span className="editar-senha-feedback editar-senha-feedback-ok">
              As senhas coincidem.
            </span>
          )}

          {mensagem && <span className="editar-senha-mensagem">{mensagem}</span>}

          <div className="perfil-botoes">
            <button
              type="submit"
              className="perfil-btn perfil-btn-primario"
              disabled={!podeSalvar}
            >
              {enviando ? "Salvando..." : "Salvar nova senha"}
            </button>
            <button
              type="button"
              className="perfil-btn perfil-btn-secundario"
              onClick={() => navigate("/cooperativa")}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>

      <BottomNav />
    </div>
  );
}

export default editar_senha;