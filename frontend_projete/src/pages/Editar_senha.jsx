import { useNavigate } from "react-router-dom";
import "./Editar_senha.css";
import BottomNav from "../components/BottomNav";

function Editar_senha() {
  const navigate = useNavigate();

  const senhausuario= localStorage.getItem("Senhanova");

  return (
    <div className="perfil-page">
      <div className="perfil-card">
        <div className="perfil-header-gradient"></div>
        

        <div className="perfil-botoes">
          <button 
            className="perfil-btn perfil-btn-primario" 
            onClick={() => navigate("/Editar_senha")}>
            Editar_senha
          </button>
        </div>
      </div>
      
      <BottomNav />
    </div>
  );
}

export default Editar_senha;