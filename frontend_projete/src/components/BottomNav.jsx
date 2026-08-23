import "./BottomNav.css";
import { useNavigate } from "react-router-dom";

function BottomNav() {
  const navigate = useNavigate();
  const tipoUsuario = localStorage.getItem("usuarioTipo");

  return (
    <nav className="bottom-nav">

      <button className="nav-item active" onClick={() => navigate("/home")}>
        <span className="icon">🏠</span>
        <span>Home</span>
      </button>

      <button className="nav-item" onClick={() => navigate("/mapa")}>
        <span className="icon">🌍</span>
        <span>Mapa</span>
      </button>

      {tipoUsuario === "agronomo" && (
        <button className="nav-item" onClick={() => navigate("/agronomo")}>
          <span className="icon">👨‍🌾</span>
          <span>Produtores</span>
        </button>
      )}

      {tipoUsuario === "cooperativa" && (
        <button className="nav-item" onClick={() => navigate("/cooperativa")}>
          <span className="icon">🏢</span>
          <span>Gestão</span>
        </button>
      )}

      <button className="nav-item">
        <span className="icon">📈</span>
        <span>Histórico</span>
      </button>

      <button className="nav-item" onClick={() => navigate("/perfil")}>
        <span className="icon">👤</span>
        <span>Perfil</span>
      </button>

    </nav>
  );
}

export default BottomNav;