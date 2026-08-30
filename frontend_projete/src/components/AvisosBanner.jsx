import { useEffect, useState } from "react";
import { AUTH_API_URL } from "../config/api";
import "./AvisosBanner.css";

// Mapeia o tipo salvo no login ('produtor'/'agronomo', singular) pro
// tipo que a rota /avisos espera ('produtores'/'agronomos', plural,
// igual está no enum destinatario_tipo do banco).
const TIPO_PARA_ROTA = {
  produtor: "produtores",
  agronomo: "agronomos",
};

function AvisosBanner() {
  const [avisos, setAvisos] = useState([]);
  const [lidos, setLidos] = useState(() => {
    const salvos = localStorage.getItem("avisosLidos");
    return salvos ? JSON.parse(salvos) : [];
  });
  const [expandido, setExpandido] = useState(false);

  const usuarioTipo = localStorage.getItem("usuarioTipo");
  const tipoRota = TIPO_PARA_ROTA[usuarioTipo];

  useEffect(() => {
    if (!tipoRota) return;

    async function buscarAvisos() {
      try {
        const resposta = await fetch(`${AUTH_API_URL}/avisos?tipo=${tipoRota}`);
        const dados = await resposta.json();
        if (resposta.ok) {
          setAvisos(dados);
        }
      } catch (erro) {
        console.error("Erro ao buscar avisos:", erro);
      }
    }

    buscarAvisos();
  }, [tipoRota]);

  function marcarComoLido(id) {
    const novosLidos = [...lidos, id];
    setLidos(novosLidos);
    localStorage.setItem("avisosLidos", JSON.stringify(novosLidos));
  }

  const avisosNaoLidos = avisos.filter((a) => !lidos.includes(a.id));

  if (avisosNaoLidos.length === 0) return null;

  const avisosParaMostrar = expandido ? avisosNaoLidos : avisosNaoLidos.slice(0, 1);

  return (
    <div className="avisos-banner">
      {avisosParaMostrar.map((aviso) => (
        <div key={aviso.id} className="avisos-item">
          <div className="avisos-icone">📢</div>
          <div className="avisos-conteudo">
            <span className="avisos-titulo">{aviso.titulo}</span>
            <p className="avisos-mensagem">{aviso.mensagem}</p>
          </div>
          <button
            type="button"
            className="avisos-fechar"
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
          {expandido ? "Mostrar menos" : `Ver mais ${avisosNaoLidos.length - 1} aviso(s)`}
        </button>
      )}
    </div>
  );
}

export default AvisosBanner;
