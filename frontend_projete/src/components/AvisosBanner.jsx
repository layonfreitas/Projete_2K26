import { useState } from "react";
import { useAvisos } from "./AvisosContext";
import "./AvisosBanner.css";

function AvisosBanner() {
  const {
    avisos,
    ativo,
    erro,
    salvando,
    marcarComoLido,
  } = useAvisos();

  const [expandido, setExpandido] = useState(false);

  const avisosNaoLidos = avisos.filter(
    (aviso) => !aviso.lido
  );

  if (!ativo || avisosNaoLidos.length === 0) {
    return null;
  }

  const avisosParaMostrar = expandido
    ? avisosNaoLidos
    : avisosNaoLidos.slice(0, 1);

  return (
    <div className="avisos-banner">
      {erro && <p role="alert">{erro}</p>}

      {avisosParaMostrar.map((aviso) => (
        <div key={aviso.id} className="avisos-item">
          <div className="avisos-icone">📢</div>

          <div className="avisos-conteudo">
            <span className="avisos-titulo">
              {aviso.titulo}
            </span>

            <p className="avisos-mensagem">
              {aviso.mensagem}
            </p>
          </div>

          <button
            type="button"
            className="avisos-fechar"
            disabled={salvando}
            onClick={() => marcarComoLido(aviso.id)}
            aria-label="Marcar aviso como lido"
          >
            ✕
          </button>
        </div>
      ))}

      {avisosNaoLidos.length > 1 && (
        <button
          type="button"
          className="avisos-mais"
          onClick={() => setExpandido(!expandido)}
        >
          {expandido
            ? "Mostrar menos"
            : `Ver mais ${avisosNaoLidos.length - 1} aviso(s)`}
        </button>
      )}
    </div>
  );
}

export default AvisosBanner;