import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!email || !senha) {
      setErro("Preencha e-mail e senha para continuar.");
      return;
    }

    // Login apenas de front-end por enquanto (sem validação real).
    // Quando o backend tiver uma rota de autenticação, troque este
    // trecho por uma chamada de API (fetch/axios) e trate a resposta.
    localStorage.setItem("autenticado", "true");

    navigate("/home");
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

          <button type="submit" className="botao-login">
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;