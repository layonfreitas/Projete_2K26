import "./BottomNav.css";
import { useNavigate } from "react-router-dom";

function BottomNav() {
  const navigate = useNavigate();

  return (
    <nav className="bottom-nav">

      <button className="nav-item active">
        <span className="icon">🏠</span>
        <span>Home</span>
      </button>

      <button className="nav-item" onClick={() => navigate("/mapa")}>
        <span className="icon">🌱</span>
        <span>Lavouras</span>
      </button>



      <button className="nav-item">
        <span className="icon">📈</span>
        <span>Histórico</span>
      </button>

      <button className="nav-item">
        <span className="icon">👤</span>
        <span>Perfil</span>
      </button>

    </nav>
  );
}

export default BottomNav;