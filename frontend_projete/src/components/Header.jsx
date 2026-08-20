import "./Header.css";

function Header() {
  const nomeUsuario = localStorage.getItem("usuarioNome");
  const produtorSelecionadoNome = localStorage.getItem("produtorSelecionadoNome");

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

      {produtorSelecionadoNome && (
        <div className="header-right">
          <span className="produtor-selecionado">
            Produtor selecionado: {produtorSelecionadoNome}
          </span>
        </div>
      )}
    </header>
  );
}

export default Header;