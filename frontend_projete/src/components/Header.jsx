import "./Header.css";

function Header() {
  const nomeUsuario = localStorage.getItem("usuarioNome");

  function pegarIniciais(nome) {
    if (!nome) return "CV";
    const partes = nome.trim().split(" ");
    if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
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
    </header>
  );
}

export default Header;