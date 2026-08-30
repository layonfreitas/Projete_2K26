import { useNavigate } from "react-router-dom";
import "./NaoEncontrado.css";

// Usada tanto pra rotas que realmente não existem quanto pra rotas que
// existem mas o tipo de usuário não tem permissão de ver (ex: um
// produtor tentando abrir /cooperativa). De propósito é a MESMA página
// nos dois casos — assim ela nunca revela "essa rota existe, você só
// não pode entrar", igual já fazemos no backend (ver auth_utils.py).
function NaoEncontrado() {
  const navigate = useNavigate();

  return (
    <div className="nao-encontrado-page">
      <div className="nao-encontrado-card">
        <span className="nao-encontrado-codigo">404</span>
        <h1>Página não encontrada</h1>
        <p>O endereço que você tentou acessar não existe ou não está disponível.</p>
        <button type="button" onClick={() => navigate("/home")}>
          Voltar para o início
        </button>
      </div>
    </div>
  );
}

export default NaoEncontrado;
