import { useNavigate } from "react-router-dom";
import "./Header.css";
import NotificationBell from "./NotificationBell";

function Header() {
  const navigate = useNavigate();
  const nomeUsuario = localStorage.getItem("usuarioNome");
  const usuarioTipo = localStorage.getItem("usuarioTipo");

  function pegarIniciais(nome) {
    if (!nome) return "CV";
    const partes = nome.trim().split(" ");
    if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  }

  
  function handleProdutor() {
    navigate("/agronomo");
  }
function receberObservacao() {
  const lavouraId = localStorage.getItem("lavouraId");

  if (!lavouraId) {
    console.error("ID da lavoura não encontrado.");
    return;
  }

  navigate(`/observacao_produtor/${lavouraId}`);
}


  return (
    <header className="header">
      <div className="header-inner">
        <div className="header-left">
          <div className="avatar">
            {pegarIniciais(nomeUsuario)}
          </div>

          <div>
            <span className="bem-vindo">
              Bem-vindo,
            </span>
            <h2>{nomeUsuario ? ` ${nomeUsuario}` : ""}</h2>
          </div>
        </div>

        <div className="header-right">
          <NotificationBell />

          {usuarioTipo === "agronomo" && (
            <button type="button" onClick={handleProdutor}>
              selecionar produtor
            </button>
          )}

            {usuarioTipo === "produtor" && (
              <button type="button" onClick={receberObservacao}>
                receber observação
              </button>
            )}
        </div>
      </div>
    </header>
  );
}

export default Header;