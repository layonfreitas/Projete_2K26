import { useEffect, useRef, useState } from "react";
import { useAvisos } from "./AvisosContext";
import "./NotificationBell.css";

function NotificationBell() {
  const {
    avisos,
    ativo,
    erro,
    salvando,
    marcarComoLido,
    marcarTodosComoLidos,
  } = useAvisos();

  const [aberto, setAberto] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function aoClicarFora(evento) {
      if (
        containerRef.current &&
        !containerRef.current.contains(evento.target)
      ) {
        setAberto(false);
      }
    }

    document.addEventListener("mousedown", aoClicarFora);

    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
    };
  }, []);

  if (!ativo) return null;

  const naoLidos = avisos.filter((aviso) => !aviso.lido);

  function formatarData(isoString) {
    return new Date(isoString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    });
  }

  return (
    <div className="notificacao-container" ref={containerRef}>
      <button
        type="button"
        className="notificacao-sino"
        onClick={() => setAberto(!aberto)}
        aria-label="Notificações"
        aria-expanded={aberto}
      >
        🔔

        {naoLidos.length > 0 && (
          <span className="notificacao-badge">
            {naoLidos.length > 9 ? "9+" : naoLidos.length}
          </span>
        )}
      </button>

      {aberto && (
        <div className="notificacao-dropdown">
          <div className="notificacao-dropdown-topo">
            <span>Avisos</span>

            {naoLidos.length > 0 && (
              <button
                type="button"
                disabled={salvando}
                onClick={marcarTodosComoLidos}
              >
                {salvando
                  ? "Salvando..."
                  : "Marcar tudo como lido"}
              </button>
            )}
          </div>

          {erro && <p role="alert">{erro}</p>}

          {!erro && avisos.length === 0 && (
            <p className="notificacao-vazio">
              Nenhum aviso por enquanto.
            </p>
          )}

          <div className="notificacao-lista">
            {avisos.map((aviso) => (
              <button
                key={aviso.id}
                type="button"
                className={`notificacao-item ${
                  aviso.lido ? "notificacao-item-lido" : ""
                }`}
                disabled={salvando}
                onClick={() => {
                  if (!aviso.lido) {
                    marcarComoLido(aviso.id);
                  }
                }}
              >
                <div className="notificacao-item-topo">
                  <span className="notificacao-item-titulo">
                    {aviso.titulo}
                  </span>

                  <span className="notificacao-item-data">
                    {formatarData(aviso.criadoEm)}
                  </span>
                </div>

                <p className="notificacao-item-mensagem">
                  {aviso.mensagem}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;