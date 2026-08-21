
import { useNavigate } from "react-router-dom";
import "./Header.css";

function Header() {
  const navigate = useNavigate();
  const nomeUsuario = localStorage.getItem("usuarioNome");
  const produtorSelecionadoNome = localStorage.getItem("produtorSelecionadoNome");
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

  return (
    <header className="header">
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
       
      {usuarioTipo === "agronomo" && (
         <button type="button" onClick={handleProdutor}>
            selecionar produtor
          </button>
      )}
    </header>
  );
}

export default Header;