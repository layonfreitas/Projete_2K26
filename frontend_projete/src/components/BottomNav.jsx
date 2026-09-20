import { NavLink } from "react-router-dom";
import Icon from "./ui/Icon";
import "./BottomNav.css";

// A cooperativa não usa mapa, upload de imagem nem histórico de lavoura —
// o menu dela fica só com o essencial.
function itensDoMenu(tipo) {
  if (tipo === "cooperativa") {
    return [
      { para: "/cooperativa", rotulo: "Gestão", icone: "predio" },
      { para: "/perfil", rotulo: "Perfil", icone: "usuario" },
    ];
  }

  return [
    { para: "/home", rotulo: "Home", icone: "casa" },
    { para: "/mapa", rotulo: "Mapa", icone: "mapa" },
    ...(tipo === "agronomo"
      ? [{ para: "/agronomo", rotulo: "Produtores", icone: "usuarios" }]
      : []),
    { para: "/historico", rotulo: "Histórico", icone: "grafico" },
    { para: "/perfil", rotulo: "Perfil", icone: "usuario" },
  ];
}

function BottomNav() {
  const tipoUsuario = localStorage.getItem("usuarioTipo");

  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      {itensDoMenu(tipoUsuario).map((item) => (
        <NavLink
          key={item.para}
          to={item.para}
          className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
        >
          <Icon nome={item.icone} tamanho={22} />
          <span>{item.rotulo}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default BottomNav;
