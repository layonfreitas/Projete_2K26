import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AUTH_API_URL } from "../config/api";
import AppBar from "../components/ui/AppBar";
import Button from "../components/ui/Button";
import { PasswordField } from "../components/ui/Field";
import { Notice } from "../components/ui/States";
import { useToast } from "../components/ui/toastContext";
import { mensagemDeErro } from "../services/erros";

function TrocarSenha() {
  const navigate = useNavigate();
  const toast = useToast();

  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmaSenha, setConfirmaSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const senhaCurta = novaSenha.length > 0 && novaSenha.length < 6;
  const naoConfere = confirmaSenha.length > 0 && novaSenha !== confirmaSenha;

  async function handleSalvar(event) {
    event.preventDefault();

    if (!senhaAtual || !novaSenha || !confirmaSenha) {
      setErro("Preencha todos os campos.");
      return;
    }
    if (senhaCurta) {
      setErro("A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (novaSenha !== confirmaSenha) {
      setErro("A nova senha e a confirmação não coincidem.");
      return;
    }

    setCarregando(true);
    setErro("");

    try {
      const usuarioId = localStorage.getItem("usuarioId");
      const resposta = await fetch(`${AUTH_API_URL}/senha/trocar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioId, senhaAtual, novaSenha }),
      });
      const dados = await resposta.json();

      if (resposta.ok) {
        toast.sucesso("Senha alterada com sucesso!");
        navigate("/perfil");
      } else {
        setErro(dados.mensagem || "Erro ao trocar senha.");
      }
    } catch (erroRequisicao) {
      setErro(mensagemDeErro(erroRequisicao, "Erro ao conectar com o servidor."));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="ui-coluna ui-coluna--sem-nav">
      <AppBar
        titulo="Trocar senha"
        subtitulo="Escolha uma senha nova para a sua conta."
        para="/perfil"
      />

      <form className="ui-conteudo" onSubmit={handleSalvar} noValidate>
        <div className="ui-cartao ui-formulario">
          <PasswordField
            label="Senha atual"
            name="senhaAtual"
            autoComplete="current-password"
            value={senhaAtual}
            onChange={(e) => setSenhaAtual(e.target.value)}
          />

          <PasswordField
            label="Nova senha"
            name="novaSenha"
            autoComplete="new-password"
            hint="Use pelo menos 6 caracteres."
            error={senhaCurta ? "A senha precisa ter pelo menos 6 caracteres." : ""}
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
          />

          <PasswordField
            label="Confirmar nova senha"
            name="confirmaSenha"
            autoComplete="new-password"
            error={naoConfere ? "As senhas não coincidem." : ""}
            value={confirmaSenha}
            onChange={(e) => setConfirmaSenha(e.target.value)}
          />

          {erro && <Notice tipo="erro">{erro}</Notice>}
        </div>

        <div className="ui-acoes-pagina">
          <Button type="submit" size="lg" block loading={carregando}>
            {carregando ? "Salvando…" : "Salvar nova senha"}
          </Button>
          <Button variant="secondary" block onClick={() => navigate("/perfil")}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}

export default TrocarSenha;
