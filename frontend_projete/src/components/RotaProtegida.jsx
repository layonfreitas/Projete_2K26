import { Navigate, useLocation } from "react-router-dom";

function RotaProtegida({ children, tiposPermitidos }) {
  const location = useLocation();

  const autenticado =
    localStorage.getItem("autenticado") === "true";

  if (!autenticado) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          voltarPara: location.pathname + location.search,
        }}
      />
    );
  }

  if (tiposPermitidos && tiposPermitidos.length > 0) {
    const usuarioTipo = localStorage.getItem("usuarioTipo");

    if (!tiposPermitidos.includes(usuarioTipo)) {
      return <Navigate to="/NaoEncontrado" replace />;
    }
  }

  return children;
}

export default RotaProtegida;
