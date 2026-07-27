import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AUTH_API_URL } from "../config/api";
import "./RecuperarSenha.css";

function RecuperarSenha() {
  const navigate = useNavigate();
  const [etapa, setEtapa] = useState(1);
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function handleSolicitar(event) {
    event.preventDefault();
    if (!email) {
      setMensagem("Informe seu e-mail.");
      return;
    }

    setCarregando(true);
    setMensagem("");

    try {
      await fetch(`${AUTH_API_URL}/senha/recuperar/solicitar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setMensagem("Se o e-mail existir, um código foi enviado.");
      setEtapa(2);
    } catch (erro) {
      setMensagem("Erro ao conectar com o servidor.");
      console.error(erro);
    } finally {
      setCarregando(false);
    }
  }

  async function handleConfirmar(event) {
    event.preventDefault();
    if (!codigo || !novaSenha) {
      setMensagem("Preencha o código e a nova senha.");
      return;
    }

    setCarregando(true);
    setMensagem("");

    try {
      const resposta = await fetch(`${AUTH_API_URL}/senha/recuperar/confirmar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, codigo, novaSenha }),
      });
      const dados = await resposta.json();

      if (resposta.ok) {
        setMensagem("Senha redefinida com sucesso! Redirecionando...");
        setTimeout(() => navigate("/login"), 1800);
      } else {
        setMensagem(dados.mensagem || "Erro ao redefinir senha.");
      }
    } catch (erro) {
      setMensagem("Erro ao conectar com o servidor.");
      console.error(erro);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="recuperar-page">
      <div className="recuperar-card">
        <h1>Recuperar senha</h1>

        {etapa === 1 && (
          <>
            <p className="recuperar-sub">
              Informe seu e-mail cadastrado para receber um código de verificação.
            </p>
            <form onSubmit={handleSolicitar}>
              <label>E-mail</label>
              <input
                type="email"
                placeholder="seuemail@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              {mensagem && <span className="recuperar-mensagem">{mensagem}</span>}

              <button type="submit" disabled={carregando}>
                {carregando ? "Enviando..." : "Enviar código"}
              </button>
            </form>
          </>
        )}

        {etapa === 2 && (
          <>
            <p className="recuperar-sub">
              Digite o código recebido no seu e-mail e a nova senha.
            </p>
            <form onSubmit={handleConfirmar}>
              <label>Código recebido</label>
              <input
                type="text"
                placeholder="Digite o código"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
              />

              <label>Nova senha</label>
              <input
                type="password"
                placeholder="••••••••"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
              />

              {mensagem && <span className="recuperar-mensagem">{mensagem}</span>}

              <button type="submit" disabled={carregando}>
                {carregando ? "Confirmando..." : "Confirmar"}
              </button>
            </form>
          </>
        )}

        <div className="recuperar-aviso">
          Não tem mais acesso a esse e-mail? Entre em contato com a
          cooperativa para receber ajuda na recuperação da sua conta.
        </div>
      </div>
    </div>
  );
}

export default RecuperarSenha;