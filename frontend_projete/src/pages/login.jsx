import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AUTH_API_URL } from "../config/api";
import AuthShell from "../components/AuthShell";
import Button from "../components/ui/Button";
import { PasswordField, TextField } from "../components/ui/Field";
import { Notice } from "../components/ui/States";
import { mensagemDeErro } from "../services/erros";

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

        navigate(dados.tipo === "cooperativa" ? "/cooperativa" : "/home");
      } else {
        setErro(dados.mensagem || "E-mail ou senha incorretos.");
      }
    } catch (erroRequisicao) {
      setErro(mensagemDeErro(erroRequisicao, "Erro ao conectar com o servidor."));
    } finally {
      setCarregando(false);
    }
  };

  return (
    <AuthShell
      titulo="Entrar"
      subtitulo="Entre para acompanhar e analisar suas lavouras."
    >
      <form className="auth-formulario" onSubmit={handleSubmit} noValidate>
        <TextField
          label="E-mail"
          type="email"
          name="email"
          placeholder="seuemail@exemplo.com"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <PasswordField
          label="Senha"
          name="senha"
          autoComplete="current-password"
          value={senha}
          onChange={(event) => setSenha(event.target.value)}
        />

        {erro && <Notice tipo="erro">{erro}</Notice>}

        <Button type="submit" size="lg" block loading={carregando}>
          {carregando ? "Entrando…" : "Entrar"}
        </Button>

        <Link className="auth-link" to="/recuperar-senha">
          Esqueceu a senha?
        </Link>
      </form>
    </AuthShell>
  );
}

export default Login;
