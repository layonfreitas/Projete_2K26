import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useLocation,
} from "react-router-dom";

import { AUTH_API_URL } from "../config/api";
import AuthShell from "../components/AuthShell";
import Button from "../components/ui/Button";
import {
  PasswordField,
  TextField,
} from "../components/ui/Field";
import { Notice } from "../components/ui/States";
import { mensagemDeErro } from "../services/erros";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  // O link do e-mail chega assim:
  // /login?lavouraId=126
  const idRecebido = new URLSearchParams(
    location.search
  ).get("lavouraId");

  const lavouraDoEmail =
    idRecebido && /^[1-9]\d*$/.test(idRecebido)
      ? idRecebido
      : null;

  // Ao acessar pelo link do e-mail, exige um novo login.
  useEffect(() => {
    if (!lavouraDoEmail) return;

    [
      "autenticado",
      "usuarioId",
      "usuarioNome",
      "usuarioEmail",
      "usuarioTipo",
    ].forEach(chave => {
      localStorage.removeItem(chave);
    });

    setEmail("");
    setSenha("");
    setErro("");
  }, [lavouraDoEmail]);

  const handleSubmit = async event => {
    event.preventDefault();

    if (carregando) return;

    const emailInformado = email.trim();

    if (!emailInformado || !senha) {
      setErro("Preencha e-mail e senha para continuar.");
      return;
    }

    setErro("");
    setCarregando(true);

    try {
      const resposta = await fetch(
        `${AUTH_API_URL}/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: emailInformado,
            senha,
          }),
        }
      );

      const dados = await resposta.json();

      if (!resposta.ok) {
        setErro(
          dados.mensagem || "E-mail ou senha incorretos."
        );
        return;
      }

      // Salva os dados somente após a API confirmar o login.
      localStorage.setItem("autenticado", "true");
      localStorage.setItem("usuarioId", dados.usuarioId);
      localStorage.setItem("usuarioNome", dados.nome);
      localStorage.setItem("usuarioEmail", emailInformado);
      localStorage.setItem("usuarioTipo", dados.tipo);

      // Destino preservado pelo componente RotaProtegida.
      const voltarPara = location.state?.voltarPara;

      // Permite retornar apenas às rotas internas esperadas.
      const destinoValido =
        typeof voltarPara === "string" &&
        /^\/(?:mapa\?lavouraId=[1-9]\d*|historico\?aba=alerta&lavouraId=[1-9]\d*)$/.test(voltarPara);

      let destino;

      if (lavouraDoEmail) {
        // Entrou pelo e-mail: abre os alertas da lavoura no histórico.
        destino = `/historico?aba=alerta&lavouraId=${lavouraDoEmail}`;
      } else if (destinoValido) {
        // Tentou abrir o mapa antes de estar autenticado.
        destino = voltarPara;
      } else {
        // Login normal: mantém o comportamento do aplicativo.
        destino =
          dados.tipo === "cooperativa"
            ? "/cooperativa"
            : "/home";
      }

      navigate(destino, { replace: true });
    } catch (erroRequisicao) {
      setErro(
        mensagemDeErro(
          erroRequisicao,
          "Erro ao conectar com o servidor."
        )
      );
    } finally {
      setCarregando(false);
    }
  };

  return (
    <AuthShell
      titulo="Entrar"
      subtitulo={
        lavouraDoEmail
          ? "Entre na sua conta para acessar a lavoura do alerta."
          : "Entre para acompanhar e analisar suas lavouras."
      }
    >
      <form
        className="auth-formulario"
        onSubmit={handleSubmit}
        noValidate
      >
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
          onChange={event => setEmail(event.target.value)}
        />

        <PasswordField
          label="Senha"
          name="senha"
          autoComplete="current-password"
          value={senha}
          onChange={event => setSenha(event.target.value)}
        />

        {erro && (
          <Notice tipo="erro">
            {erro}
          </Notice>
        )}

        <Button
          type="submit"
          size="lg"
          block
          loading={carregando}
        >
          {carregando ? "Entrando…" : "Entrar"}
        </Button>

        <Link
          className="auth-link"
          to="/recuperar-senha"
        >
          Esqueceu a senha?
        </Link>
      </form>
    </AuthShell>
  );
}

export default Login;
