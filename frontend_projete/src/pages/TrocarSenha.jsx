import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AUTH_API_URL } from "../config/api";
import "./TrocarSenha.css";

function TrocarSenha() {
  const navigate = useNavigate();
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmaSenha, setConfirmaSenha] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function handleSalvar(event) {
    event.preventDefault();

    if (!senhaAtual || !novaSenha || !confirmaSenha) {
      setMensagem("Preencha todos os campos.");
      return;
    }
    if (novaSenha !== confirmaSenha) {
      setMensagem("A nova senha e a confirmação não coincidem.");
      return;
    }

    setCarregando(true);
    setMensagem("");

    try {
      const usuarioId = localStorage.getItem("usuarioId");
      const resposta = await fetch(`${AUTH_API_URL}/senha/trocar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioId, senhaAtual, novaSenha }),
      });
      const dados = await resposta.json();

      if (resposta.ok) {
        setMensagem("Senha alterada com sucesso!");
        setTimeout(() => navigate("/perfil"), 1500);
      } else {
        setMensagem(dados.mensagem || "Erro ao trocar senha.");
      }
    } catch (erro) {
      setMensagem("Erro ao conectar com o servidor.");
      console.error(erro);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="trocar-page">
      <div className="trocar-card">
        <h1>Trocar senha</h1>

        <form onSubmit={handleSalvar}>
          <label>Senha atual</label>
          <input
            type="password"
            value={senhaAtual}
            onChange={(e) => setSenhaAtual(e.target.value)}
          />

          <label>Nova senha</label>
          <input
            type="password"
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
          />

          <label>Confirmar nova senha</label>
          <input
            type="password"
            value={confirmaSenha}
            onChange={(e) => setConfirmaSenha(e.target.value)}
          />

          {mensagem && <span className="trocar-mensagem">{mensagem}</span>}

          <button type="submit" disabled={carregando}>
            {carregando ? "Salvando..." : "Salvar nova senha"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default TrocarSenha;