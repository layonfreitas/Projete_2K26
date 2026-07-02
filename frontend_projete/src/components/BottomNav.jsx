import "./BottomNav.css";

function BottomNav() {
  return (
    <nav className="bottom-nav">

      <button className="nav-item active">
        <span className="icon">🏠</span>
        <span>Home</span>
      </button>

      <button className="nav-item">
        <span className="icon">🌱</span>
        <span>Lavouras</span>
      </button>

      <button className="nav-item center-button">
        <span className="camera">📷</span>
      </button>

      <button className="nav-item">
        <span className="icon">📈</span>
        <span>Histórico</span>
      </button>

      <button className="nav-item">
        <span className="icon">👤</span>
        <span>Perfil</span>
      </button>

    </nav>
  );
}

export default BottomNav;