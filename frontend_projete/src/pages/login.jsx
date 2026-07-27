import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AUTH_API_URL } from "../config/api";
import "./login.css";

function Login() {
  const navigate = useNavigate();

  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!email || !senha || !nome) {
      setErro("Preencha nome,e-mail e senha para continuar.");
      return;
    }

    setErro("");
    setCarregando(true);

    try {
      const resposta = await fetch(`${AUTH_API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, senha }),
      });

      const dados = await resposta.json();

      if (resposta.ok) {
        // guarda o id e o nome do usuário logado, pra usar depois
        // (ex: mandar junto no cadastro de lavoura)
        localStorage.setItem("autenticado", "true");
        localStorage.setItem("usuarioId", dados.usuarioId);
        localStorage.setItem("usuarioNome", dados.nome);

        navigate("/home");
      } else {
        setErro(dados.mensagem || "E-mail ou senha incorretos.");
      }
    } catch (erroRequisicao) {
      setErro("Erro ao conectar com o servidor.");
      console.error(erroRequisicao);
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
          <label htmlFor="nome">Nome de usuário</label>
          <input
            id="nome"
            type="text"
            placeholder="Seu nome de usuário"
            value={nome}
            onChange={(event) => setNome(event.target.value)}
          />
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
        </form>
      </div>
    </div>
  );
}

export default Login;