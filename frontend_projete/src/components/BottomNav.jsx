import "./BottomNav.css";
import { useNavigate } from "react-router-dom";

function BottomNav() {
  const navigate = useNavigate();
  const tipoUsuario = localStorage.getItem("usuarioTipo");

  // A cooperativa não usa mapa, upload de imagem nem histórico de
  // lavoura — o menu dela fica só com o essencial.
  if (tipoUsuario === "cooperativa") {
    return (
      <nav className="bottom-nav">
        <button className="nav-item active" onClick={() => navigate("/cooperativa")}>
          <span className="icon">🏢</span>
          <span>Gestão</span>
        </button>

        <button className="nav-item" onClick={() => navigate("/perfil")}>
          <span className="icon">👤</span>
          <span>Perfil</span>
        </button>
      </nav>
    );
  }

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