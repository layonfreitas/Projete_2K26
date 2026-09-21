import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./perfil.css";
import BottomNav from "../components/BottomNav";
import Avatar from "../components/ui/Avatar";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import Sheet from "../components/ui/Sheet";
import { Badge } from "../components/ui/States";
import { encerrarSessao } from "../services/sessao";
import { ROTULO_TIPO } from "../utils/texto";

function Perfil() {
  const navigate = useNavigate();
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);

  const nomeUsuario = localStorage.getItem("usuarioNome");
  const emailUsuario = localStorage.getItem("usuarioEmail");
  const tipoUsuario = localStorage.getItem("usuarioTipo");

  function handleSair() {
    encerrarSessao();
    navigate("/login");
  }

  return (
    <div className="ui-coluna">
      <main className="perfil">
        <section className="perfil-capa">
          <Avatar nome={nomeUsuario} tamanho={88} tom="gold" className="perfil-avatar" />
          <h1>{nomeUsuario || "Usuário"}</h1>
          <p>{emailUsuario}</p>
          {tipoUsuario && <Badge tom="ok">{ROTULO_TIPO[tipoUsuario] || tipoUsuario}</Badge>}
        </section>

        <section className="ui-cartao perfil-secao" aria-labelledby="perfil-conta">
          <h2 id="perfil-conta">Dados da conta</h2>
          <dl className="perfil-dados">
            <div>
              <dt>Nome</dt>
              <dd>{nomeUsuario || "Não informado"}</dd>
            </div>
            <div>
              <dt>E-mail</dt>
              <dd>{emailUsuario || "Não informado"}</dd>
            </div>
            <div>
              <dt>Tipo de conta</dt>
              <dd>{ROTULO_TIPO[tipoUsuario] || "Não informado"}</dd>
            </div>
          </dl>
        </section>

        <section className="ui-cartao perfil-secao" aria-labelledby="perfil-seguranca">
          <h2 id="perfil-seguranca">Segurança</h2>
          <button type="button" className="perfil-linha-acao" onClick={() => navigate("/trocar-senha")}>
            <span className="perfil-linha-icone" aria-hidden="true">
              <Icon nome="chave" />
            </span>
            <span className="perfil-linha-texto">
              <strong>Trocar senha</strong>
              <small>Atualize a senha de acesso</small>
            </span>
            <Icon nome="setaDireita" />
          </button>
        </section>

        <Button variant="danger-soft" size="lg" block icon="sair" onClick={() => setConfirmandoSaida(true)}>
          Sair da conta
        </Button>
      </main>

      <Sheet
        aberto={confirmandoSaida}
        aoFechar={() => setConfirmandoSaida(false)}
        titulo="Sair da conta?"
        descricao="Você precisará entrar novamente para ver suas lavouras."
      >
        <div className="ui-painel-botoes">
          <Button variant="secondary" data-foco onClick={() => setConfirmandoSaida(false)}>
            Continuar no app
          </Button>
          <Button variant="danger" icon="sair" onClick={handleSair}>
            Sair
          </Button>
        </div>
      </Sheet>

      <BottomNav />
    </div>
  );
}

export default Perfil;
