import { useEffect, useId, useRef, useState } from "react";
import { useAvisos } from "./AvisosContext";
import Icon from "./ui/Icon";
import { formatarData } from "../utils/texto";
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
  const botaoRef = useRef(null);
  const painelId = useId();

  useEffect(() => {
    if (!aberto) return undefined;

    function aoClicarFora(evento) {
      if (containerRef.current && !containerRef.current.contains(evento.target)) {
        setAberto(false);
      }
    }

    function aoTeclar(evento) {
      if (evento.key === "Escape") {
        setAberto(false);
        botaoRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);

    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  if (!ativo) return null;

  const naoLidos = avisos.filter((aviso) => !aviso.lido);

  return (
    <div className="notificacao-container" ref={containerRef}>
      <button
        ref={botaoRef}
        type="button"
        className="notificacao-sino"
        onClick={() => setAberto(!aberto)}
        aria-label={
          naoLidos.length > 0
            ? `Notificações: ${naoLidos.length} não lidas`
            : "Notificações"
        }
        aria-expanded={aberto}
        aria-controls={painelId}
      >
        <Icon nome="sino" tamanho={20} />

        {naoLidos.length > 0 && (
          <span className="notificacao-badge" aria-hidden="true">
            {naoLidos.length > 9 ? "9+" : naoLidos.length}
          </span>
        )}
      </button>

      {aberto && (
        <div className="notificacao-dropdown" id={painelId}>
          <div className="notificacao-dropdown-topo">
            <strong>Avisos</strong>

            {naoLidos.length > 0 && (
              <button type="button" disabled={salvando} onClick={marcarTodosComoLidos}>
                {salvando ? "Salvando…" : "Marcar tudo como lido"}
              </button>
            )}
          </div>

          {erro && (
            <p className="notificacao-erro" role="alert">
              {erro}
            </p>
          )}

          {!erro && avisos.length === 0 && (
            <div className="notificacao-vazio">
              <Icon nome="sino" tamanho={24} />
              <p>Nenhum aviso por enquanto.</p>
            </div>
          )}

          <div className="notificacao-lista">
            {avisos.map((aviso) => (
              <button
                key={aviso.id}
                type="button"
                className={`notificacao-item ${aviso.lido ? "notificacao-item-lido" : ""}`}
                disabled={salvando}
                onClick={() => {
                  if (!aviso.lido) marcarComoLido(aviso.id);
                }}
              >
                <span className="notificacao-ponto" aria-hidden="true" />

                <span className="notificacao-item-corpo">
                  <span className="notificacao-item-topo">
                    <span className="notificacao-item-titulo">{aviso.titulo}</span>
                    <span className="notificacao-item-data">{formatarData(aviso.criadoEm)}</span>
                  </span>

                  <span className="notificacao-item-mensagem">{aviso.mensagem}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
