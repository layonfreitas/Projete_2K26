import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { AUTH_API_URL } from "../config/api";

import AuthShell from "../components/AuthShell";
import Button from "../components/ui/Button";
import { PasswordField, TextField } from "../components/ui/Field";
import { Notice } from "../components/ui/States";

import { mensagemDeErro } from "../services/erros";

import "./CadastroUsuario.css";

function Cadastro() {
  const navigate = useNavigate();

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [tipo, setTipo] = useState("");

  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [carregando, setCarregando] = useState(false);

  // Se o usuário já estiver autenticado,
  // não precisa passar novamente pelo cadastro.
  useEffect(() => {
    const autenticado = localStorage.getItem("autenticado");

    if (autenticado === "true") {
      const usuarioTipo = localStorage.getItem("usuarioTipo");

      navigate(
        usuarioTipo === "cooperativa" ? "/cooperativa" : "/home",
        { replace: true }
      );
    }
  }, [navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    setErro("");
    setSucesso("");

    if (!nome || !email || !senha || !confirmarSenha || !tipo) {
      setErro("Preencha todos os campos para continuar.");
      return;
    }

    if (senha !== confirmarSenha) {
      setErro("As senhas não coincidem.");
      return;
    }

    if (senha.length < 6) {
      setErro("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setCarregando(true);

    try {
      const resposta = await fetch(`${AUTH_API_URL}/cadastro`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nome,
          email,
          senha,
          tipo,
        }),
      });

      const dados = await resposta.json();

      if (resposta.ok) {
        setSucesso("Conta criada com sucesso! Redirecionando...");

        /*
         * Se o backend NÃO fizer login automático após o cadastro,
         * mandamos o usuário para a página de login.
         */
        setTimeout(() => {
          navigate("/login");
        }, 1200);
      } else {
        setErro(
          dados.mensagem ||
            "Não foi possível criar a conta. Verifique os dados informados."
        );
      }
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
      titulo="Criar conta"
      subtitulo="Crie seu perfil para começar a acompanhar suas lavouras."
    >
      <form
        className="auth-formulario cadastro-formulario"
        onSubmit={handleSubmit}
        noValidate
      >
        <TextField
          label="Nome"
          type="text"
          name="nome"
          placeholder="Seu nome completo"
          autoComplete="name"
          value={nome}
          onChange={(event) => setNome(event.target.value)}
        />

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

        <div className="cadastro-tipo">
          <span className="cadastro-tipo-label">
            Como você vai usar o CoffeeVision?
          </span>

          <div className="tipo-opcoes">
            <button
              type="button"
              className={`tipo-opcao ${
                tipo === "produtor" ? "selecionado" : ""
              }`}
              onClick={() => setTipo("produtor")}
            >
              <span className="tipo-icone">🌱</span>

              <span className="tipo-conteudo">
                <strong>Produtor</strong>
                <small>
                  Acompanhe suas lavouras, clima e diagnósticos.
                </small>
              </span>
            </button>

            <button
              type="button"
              className={`tipo-opcao ${
                tipo === "agronomo" ? "selecionado" : ""
              }`}
              onClick={() => setTipo("agronomo")}
            >
              <span className="tipo-icone">🌿</span>

              <span className="tipo-conteudo">
                <strong>Agrônomo</strong>
                <small>
                  Acompanhe produtores e registre laudos técnicos.
                </small>
              </span>
            </button>
          </div>
        </div>

        <PasswordField
          label="Senha"
          name="senha"
          autoComplete="new-password"
          value={senha}
          onChange={(event) => setSenha(event.target.value)}
        />

        <PasswordField
          label="Confirmar senha"
          name="confirmarSenha"
          autoComplete="new-password"
          value={confirmarSenha}
          onChange={(event) => setConfirmarSenha(event.target.value)}
        />

        {erro && <Notice tipo="erro">{erro}</Notice>}

        {sucesso && <Notice tipo="sucesso">{sucesso}</Notice>}

        <Button
          type="submit"
          size="lg"
          block
          loading={carregando}
        >
          {carregando ? "Criando conta…" : "Criar minha conta"}
        </Button>

        <div className="cadastro-login">
          <span>Já possui uma conta?</span>

          <Link className="auth-link" to="/login">
            Entrar
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}

export default Cadastro;