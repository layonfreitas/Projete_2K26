import { useNavigate } from "react-router-dom";
import "./perfil.css";
import BottomNav from "../components/BottomNav";

function Perfil() {
  const navigate = useNavigate();

  const nomeUsuario = localStorage.getItem("usuarioNome");
  const emailUsuario = localStorage.getItem("usuarioEmail");

  function pegarIniciais(nome) {
    if (!nome) return "CV";
    const partes = nome.trim().split(" ");
    if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  }
  function editarteste(){
    navigate("/home");
  }

  function handleSair() {
    localStorage.removeItem("autenticado");
    localStorage.removeItem("usuarioId");
    localStorage.removeItem("usuarioNome");
    localStorage.removeItem("usuarioEmail");
    navigate("/login");
  }

  return (
    <div className="perfil-page">
      <div className="perfil-card">
        <div className="perfil-header-gradient"></div>
        
        <div className="perfil-avatar">{pegarIniciais(nomeUsuario)}</div>

        <h2 className="perfil-nome">{nomeUsuario || "Usuário"}</h2>
        <p className="perfil-email">{emailUsuario}</p>

        <div className="perfil-info">
          <div className="perfil-linha">
            <span className="perfil-label">Nome:</span>
            <span className="perfil-valor">{nomeUsuario || "Não informado"}</span>
          </div>
          <div className="perfil-linha">
            <span className="perfil-label">Email:</span>
            <span className="perfil-valor">{emailUsuario || "Não informado"}</span>     
          </div>
        </div>

        <div className="perfil-botoes">
          <button 
            className="perfil-btn perfil-btn-primario" 
            onClick={() => navigate("/trocar-senha")}
          >
            Trocar senha
          </button>

          <button 
            className="perfil-btn perfil-btn-secundario" 
            onClick={handleSair}
          >
            Sair da conta
          </button>
          <button 
            className="perfil-btn perfil-btn-secundario" 
            onClick={editarteste}
          >
            voltar
          </button>
        </div>
      </div>
      
      <BottomNav />
    </div>
  );
}

export default Perfil;