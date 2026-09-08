import "./BottomNav.css";
import { useNavigate, useLocation } from "react-router-dom";

function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const tipoUsuario = localStorage.getItem("usuarioTipo");

  // Marca o botão como ativo se a rota atual começa com o caminho dele.
  // Assim "/mapa" e também "/mapa/algumacoisa" (se existir) acendem o mesmo botão.
  const classeItem = (caminho) =>
    location.pathname.startsWith(caminho) ? "nav-item active" : "nav-item";

  // A cooperativa não usa mapa, upload de imagem nem histórico de
  // lavoura — o menu dela fica só com o essencial.
  if (tipoUsuario === "cooperativa") {
    return (
      <nav className="bottom-nav">
        <button className={classeItem("/cooperativa")} onClick={() => navigate("/cooperativa")}>
          <span className="icon">🏢</span>
          <span>Gestão</span>
        </button>

        <button className={classeItem("/perfil")} onClick={() => navigate("/perfil")}>
          <span className="icon">👤</span>
          <span>Perfil</span>
        </button>
      </nav>
    );
  }

  return (
    <nav className="bottom-nav">

      <button className={classeItem("/home")} onClick={() => navigate("/home")}>
        <span className="icon">🏠</span>
        <span>Home</span>
      </button>

      <button className={classeItem("/mapa")} onClick={() => navigate("/mapa")}>
        <span className="icon">🌍</span>
        <span>Mapa</span>
      </button>

      {tipoUsuario === "agronomo" && (
        <button className={classeItem("/agronomo")} onClick={() => navigate("/agronomo")}>
          <span className="icon">👨‍🌾</span>
          <span>Produtores</span>
        </button>
      )}

      <button className={classeItem("/historico")} onClick={() => navigate("/historico")}>
        <span className="icon">📈</span>
        <span>Histórico</span>
      </button>

      <button className={classeItem("/perfil")} onClick={() => navigate("/perfil")}>
        <span className="icon">👤</span>
        <span>Perfil</span>
      </button>

    </nav>
  );
}

export default BottomNav;