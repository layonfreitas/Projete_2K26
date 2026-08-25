import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AUTH_API_URL } from "../config/api";
import "./login.css";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!email || !senha) {
      setErro("Preencha e-mail e senha para continuar.");
      return;
    }

    setErro("");
    setCarregando(true);

    try {
      const resposta = await fetch(`${AUTH_API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha }),
      });

      const dados = await resposta.json();

      if (resposta.ok) {
        localStorage.setItem("autenticado", "true");
        localStorage.setItem("usuarioId", dados.usuarioId);
        localStorage.setItem("usuarioNome", dados.nome);
        localStorage.setItem("usuarioEmail", email);
        localStorage.setItem("usuarioTipo", dados.tipo);
        //console.log("Login bem-sucedido:", usuarioTipo);

        navigate(dados.tipo === "cooperativa" ? "/cooperativa" : "/home");
      } else {
        setErro(dados.mensagem || "E-mail ou senha incorretos.");
      }
    } catch (erroRequisicao) {
      setErro("Erro ao conectar com o servidor.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="avatar-login">CV</div>
          <h1>Coffee Vision</h1>
          <p>Entre para analisar suas lavouras</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            placeholder="seuemail@exemplo.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <label htmlFor="senha">Senha</label>
          <input
            id="senha"
            type="password"
            placeholder="••••••••"
            value={senha}
            onChange={(event) => setSenha(event.target.value)}
          />

          {erro && <span className="login-erro">{erro}</span>}

          <button type="submit" className="botao-login" disabled={carregando}>
            {carregando ? "Entrando..." : "Entrar"}
          </button>

          <a className="link-esqueceu-senha" onClick={() => navigate("/recuperar-senha")}>
            Esqueceu a senha?
          </a>         
        </form>

      </div>
    </div>
  );
}

export default Login;