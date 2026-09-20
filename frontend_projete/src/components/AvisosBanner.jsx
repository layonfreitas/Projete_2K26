import { useState } from "react";
import { useAvisos } from "./AvisosContext";
import Icon from "./ui/Icon";
import "./AvisosBanner.css";

// Avisos não lidos vindos da cooperativa, no topo da Home.
function AvisosBanner() {
  const { avisos, ativo, erro, salvando, marcarComoLido } = useAvisos();
  const [expandido, setExpandido] = useState(false);

  const avisosNaoLidos = avisos.filter((aviso) => !aviso.lido);

  if (!ativo || avisosNaoLidos.length === 0) {
    return null;
  }

  const avisosParaMostrar = expandido ? avisosNaoLidos : avisosNaoLidos.slice(0, 1);

  return (
    <section className="avisos-banner" aria-label="Avisos da cooperativa">
      {erro && (
        <p className="avisos-erro" role="alert">
          {erro}
        </p>
      )}

      {avisosParaMostrar.map((aviso) => (
        <div key={aviso.id} className="avisos-item">
          <span className="avisos-icone" aria-hidden="true">
            <Icon nome="megafone" tamanho={20} />
          </span>

          <div className="avisos-conteudo">
            <strong className="avisos-titulo">{aviso.titulo}</strong>
            <p className="avisos-mensagem">{aviso.mensagem}</p>
          </div>

          <button
            type="button"
            className="avisos-fechar"
            disabled={salvando}
            onClick={() => marcarComoLido(aviso.id)}
            aria-label={`Marcar como lido: ${aviso.titulo}`}
            title="Marcar como lido"
          >
            <Icon nome="fechar" tamanho={18} />
          </button>
        </div>
      ))}

      {avisosNaoLidos.length > 1 && (
        <button type="button" className="avisos-mais" onClick={() => setExpandido(!expandido)}>
          {expandido
            ? "Mostrar menos"
            : `Ver mais ${avisosNaoLidos.length - 1} ${
                avisosNaoLidos.length - 1 === 1 ? "aviso" : "avisos"
              }`}
        </button>
      )}
    </section>
  );
}

export default AvisosBanner;
