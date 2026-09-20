import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AUTH_API_URL } from "../config/api";
import AuthShell from "../components/AuthShell";
import Button from "../components/ui/Button";
import { PasswordField, TextField } from "../components/ui/Field";
import { Notice } from "../components/ui/States";
import { mensagemDeErro } from "../services/erros";

const ESPERA_REENVIO = 30; // segundos

function RecuperarSenha() {
  const navigate = useNavigate();
  const [etapa, setEtapa] = useState(1);
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [mensagem, setMensagem] = useState(null); // { tipo, texto }
  const [carregando, setCarregando] = useState(false);
  const [espera, setEspera] = useState(0);
  const timerRedirecionar = useRef(null);

  // contagem regressiva para poder pedir outro código
  useEffect(() => {
    if (espera <= 0) return undefined;
    const tempo = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(tempo);
  }, [espera]);

  useEffect(() => () => clearTimeout(timerRedirecionar.current), []);

  async function solicitarCodigo() {
    setCarregando(true);
    setMensagem(null);

    try {
      const resposta = await fetch(`${AUTH_API_URL}/senha/recuperar/solicitar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const dados = await resposta.json();

      if (resposta.ok) {
        setMensagem({ tipo: "sucesso", texto: "Código enviado para o seu e-mail." });
        setEtapa(2);
        setEspera(ESPERA_REENVIO);
      } else {
        setMensagem({
          tipo: "erro",
          texto: dados.mensagem || "Não foi possível enviar o código.",
        });
      }
    } catch (erro) {
      setMensagem({ tipo: "erro", texto: mensagemDeErro(erro, "Erro ao conectar com o servidor.") });
    } finally {
      setCarregando(false);
    }
  }

  function handleSolicitar(event) {
    event.preventDefault();
    if (!email.trim()) {
      setMensagem({ tipo: "erro", texto: "Informe seu e-mail." });
      return;
    }
    solicitarCodigo();
  }

  async function handleConfirmar(event) {
    event.preventDefault();
    if (!codigo || !novaSenha) {
      setMensagem({ tipo: "erro", texto: "Preencha o código e a nova senha." });
      return;
    }
    if (novaSenha.length < 6) {
      setMensagem({ tipo: "erro", texto: "A nova senha precisa ter pelo menos 6 caracteres." });
      return;
    }

    setCarregando(true);
    setMensagem(null);

    try {
      const resposta = await fetch(`${AUTH_API_URL}/senha/recuperar/confirmar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, codigo, novaSenha }),
      });
      const dados = await resposta.json();

      if (resposta.ok) {
        setMensagem({ tipo: "sucesso", texto: "Senha redefinida com sucesso! Redirecionando…" });
        timerRedirecionar.current = setTimeout(() => navigate("/login"), 1800);
      } else {
        setMensagem({ tipo: "erro", texto: dados.mensagem || "Erro ao redefinir senha." });
      }
    } catch (erro) {
      setMensagem({ tipo: "erro", texto: mensagemDeErro(erro, "Erro ao conectar com o servidor.") });
    } finally {
      setCarregando(false);
    }
  }

  function trocarEmail() {
    setEtapa(1);
    setCodigo("");
    setNovaSenha("");
    setMensagem(null);
  }

  return (
    <AuthShell
      titulo="Recuperar senha"
      subtitulo={
        etapa === 1
          ? "Informe seu e-mail cadastrado para receber um código de verificação."
          : `Digite o código enviado para ${email} e escolha a nova senha.`
      }
      rodape="Não tem mais acesso a esse e-mail? Entre em contato com a cooperativa para receber ajuda na recuperação da sua conta."
    >
      <div className="auth-passos" role="img" aria-label={`Passo ${etapa} de 2`}>
        <span className="feito" />
        <span className={etapa === 2 ? "feito" : ""} />
      </div>

      {etapa === 1 && (
        <form className="auth-formulario" onSubmit={handleSolicitar} noValidate>
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
            onChange={(e) => setEmail(e.target.value)}
          />

          {mensagem && <Notice tipo={mensagem.tipo}>{mensagem.texto}</Notice>}

          <Button type="submit" size="lg" block loading={carregando}>
            {carregando ? "Enviando…" : "Enviar código"}
          </Button>

          <Link className="auth-link" to="/login">
            Voltar para o login
          </Link>
        </form>
      )}

      {etapa === 2 && (
        <form className="auth-formulario" onSubmit={handleConfirmar} noValidate>
          <TextField
            label="Código recebido"
            name="codigo"
            placeholder="Digite o código"
            autoComplete="one-time-code"
            inputMode="numeric"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
          />

          <PasswordField
            label="Nova senha"
            name="novaSenha"
            autoComplete="new-password"
            hint="Use pelo menos 6 caracteres."
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
          />

          {mensagem && <Notice tipo={mensagem.tipo}>{mensagem.texto}</Notice>}

          <Button type="submit" size="lg" block loading={carregando}>
            {carregando ? "Confirmando…" : "Confirmar"}
          </Button>

          <div className="auth-acoes-secundarias">
            <Button
              variant="ghost"
              size="sm"
              onClick={solicitarCodigo}
              disabled={carregando || espera > 0}
            >
              {espera > 0 ? `Reenviar código em ${espera}s` : "Reenviar código"}
            </Button>
            <Button variant="ghost" size="sm" onClick={trocarEmail} disabled={carregando}>
              Usar outro e-mail
            </Button>
          </div>
        </form>
      )}
    </AuthShell>
  );
}

export default RecuperarSenha;
