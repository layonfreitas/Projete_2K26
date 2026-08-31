import { Navigate } from "react-router-dom";

// `tiposPermitidos` é opcional: se não for passado, só exige estar logado
// (comportamento antigo). Se for passado (ex: ["cooperativa"]), também
// exige que o usuarioTipo salvo no login bata com um dos tipos da lista.
//
// Quem não tem permissão vai pra /nao-encontrado (uma página de "404"),
// não pra /home -- de propósito, pra deixar claro que o acesso foi
// negado (em vez de só "voltar sozinho" sem explicação), mas sem revelar
// que a rota de fato existe (mesma lógica do backend, ver auth_utils.py).
function RotaProtegida({ children, tiposPermitidos }) {
  const autenticado = localStorage.getItem("autenticado") === "true";

  if (!autenticado) {
    return <Navigate to="/login" replace />;
  }

  if (tiposPermitidos && tiposPermitidos.length > 0) {
    const usuarioTipo = localStorage.getItem("usuarioTipo");
    if (!tiposPermitidos.includes(usuarioTipo)) {
      return <Navigate to="/nao-encontrado" replace />;
    }
  }

  return children;
}

export default RotaProtegida;