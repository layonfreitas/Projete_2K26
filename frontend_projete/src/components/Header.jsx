import "./Header.css";

function Header() {
  return (
    <header className="header">

      <div className="header-left">

        <div className="avatar">
          CV
        </div>

        <div>
          <span className="bem-vindo">
            Bem-vindo
          </span>

          <h2>Coffee Vision</h2>
        </div>

      </div>

      <button className="notificacao">
        🔔
      </button>

    </header>
  );
}

export default Header;