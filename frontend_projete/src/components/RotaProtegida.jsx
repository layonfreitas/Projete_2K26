import { Navigate } from "react-router-dom";

// `tiposPermitidos` é opcional: se não for passado, só exige estar logado
// (comportamento antigo). Se for passado (ex: ["cooperativa"]), também
// exige que o usuarioTipo salvo no login bata com um dos tipos da lista.
function RotaProtegida({ children, tiposPermitidos }) {
  const autenticado = localStorage.getItem("autenticado") === "true";

  if (!autenticado) {
    return <Navigate to="/login" replace />;
  }

  if (tiposPermitidos && tiposPermitidos.length > 0) {
    const usuarioTipo = localStorage.getItem("usuarioTipo");
    if (!tiposPermitidos.includes(usuarioTipo)) {
      return <Navigate to="/home" replace />;
    }
  }

  return children;
}

export default RotaProtegida;