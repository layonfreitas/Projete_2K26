import "./QuickActions.css";

function QuickActions() {
  return (
    <section className="quick-actions">

      <h3 className="titulo-section">
        Acesso Rápido
      </h3>

      <div className="grid-actions">

        <div className="action-card">
          <div className="icone">🌱</div>

          <h4>Minhas Lavouras</h4>

          <p>Gerencie todas as áreas cadastradas.</p>
        </div>

        <div className="action-card">
          <div className="icone">📈</div>

          <h4>Histórico</h4>

          <p>Veja todas as análises realizadas.</p>
        </div>

        <div className="action-card">
          <div className="icone">🛰️</div>

          <h4>Mapas</h4>

          <p>Visualize NDVI e índices da lavoura.</p>
        </div>

        <div className="action-card">
          <div className="icone">👨‍🌾</div>

          <h4>Perfil</h4>

          <p>Informações da sua conta.</p>
        </div>

      </div>

    </section>
  );
}

export default QuickActions;