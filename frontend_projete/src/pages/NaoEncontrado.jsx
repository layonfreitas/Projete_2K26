import { useNavigate } from "react-router-dom";
import "./NaoEncontrado.css";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";

// Usada tanto pra rotas que realmente não existem quanto pra rotas que
// existem mas o tipo de usuário não tem permissão de ver (ex: um
// produtor tentando abrir /cooperativa). De propósito é a MESMA página
// nos dois casos — assim ela nunca revela "essa rota existe, você só
// não pode entrar", igual já fazemos no backend (ver auth_utils.py).
function NaoEncontrado() {
  const navigate = useNavigate();

  const autenticado = localStorage.getItem("autenticado") === "true";
  const tipo = localStorage.getItem("usuarioTipo");

  const destino = !autenticado ? "/login" : tipo === "cooperativa" ? "/cooperativa" : "/home";
  const rotulo = !autenticado ? "Ir para o login" : "Voltar para o início";

  return (
    <div className="nf-pagina">
      <main className="nf-cartao">
        <span className="nf-icone" aria-hidden="true">
          <Icon nome="mapa" tamanho={30} />
        </span>
        <span className="nf-codigo">404</span>
        <h1>Página não encontrada</h1>
        <p>O endereço que você tentou acessar não existe ou não está disponível.</p>
        <Button size="lg" block onClick={() => navigate(destino, { replace: true })}>
          {rotulo}
        </Button>
      </main>
    </div>
  );
}

export default NaoEncontrado;
