import { useNavigate } from "react-router-dom";
import "./Header.css";
import NotificationBell from "./NotificationBell";
import Avatar from "./ui/Avatar";
import Button from "./ui/Button";
import Icon from "./ui/Icon";
import { useToast } from "./ui/toastContext";

function Header() {
  const navigate = useNavigate();
  const toast = useToast();

  const nomeUsuario = localStorage.getItem("usuarioNome");
  const usuarioTipo = localStorage.getItem("usuarioTipo");
  const produtorNome = localStorage.getItem("produtorSelecionadoNome");

  function receberObservacao() {
    const lavouraId = localStorage.getItem("lavouraId");

    if (!lavouraId) {
      toast.info("Cadastre uma lavoura para receber observações do seu agrônomo.");
      return;
    }

    navigate(`/observacao_produtor/${lavouraId}`);
  }

  return (
    <header className="header">
      <div className="header-inner">
        <div className="header-linha">
          <div className="header-left">
            <Avatar nome={nomeUsuario} tom="gold" tamanho={46} className="header-avatar" />

            <div className="header-texto">
              <span className="bem-vindo">Bem-vindo,</span>
              <h2>{nomeUsuario || "Usuário"}</h2>
            </div>
          </div>

          <NotificationBell />
        </div>

        {usuarioTipo === "agronomo" && (
          <div className="header-contexto">
            <span className="header-contexto-icone" aria-hidden="true">
              <Icon nome="usuarios" />
            </span>
            <div className="header-contexto-texto">
              <small>Acompanhando</small>
              <strong>{produtorNome || "Nenhum produtor"}</strong>
            </div>
            <Button
              variant="glass"
              size="sm"
              icon="trocar"
              onClick={() => navigate("/agronomo")}
            >
              {produtorNome ? "Trocar" : "Selecionar"}
            </Button>
          </div>
        )}

        {usuarioTipo === "produtor" && (
          <div className="header-contexto">
            <span className="header-contexto-icone" aria-hidden="true">
              <Icon nome="mensagem" />
            </span>
            <div className="header-contexto-texto">
              <small>Do seu agrônomo</small>
              <strong>Observações da lavoura</strong>
            </div>
            <Button variant="glass" size="sm" onClick={receberObservacao}>
              Ver
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;
