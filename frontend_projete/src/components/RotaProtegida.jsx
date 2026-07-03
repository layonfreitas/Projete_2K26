import { Navigate } from "react-router-dom";

function RotaProtegida({ children }) {
  const autenticado = localStorage.getItem("autenticado") === "true";

  if (!autenticado) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default RotaProtegida;