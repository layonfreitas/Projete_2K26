import { useEffect, useRef, useState } from "react";
import { AUTH_API_URL } from "../config/api";
import "./NotificationBell.css";

// Mesmo mapeamento do AvisosBanner: tipo salvo no login (singular)
// -> tipo que a rota /avisos espera (plural, igual o enum no banco).
const TIPO_PARA_ROTA = {
  produtor: "produtores",
  agronomo: "agronomos",
};

function NotificationBell() {
  const [avisos, setAvisos] = useState([]);
  const [lidos, setLidos] = useState(() => {
    const salvos = localStorage.getItem("avisosLidos");
    return salvos ? JSON.parse(salvos) : [];
  });
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef(null);

  const usuarioTipo = localStorage.getItem("usuarioTipo");
  const tipoRota = TIPO_PARA_ROTA[usuarioTipo];

  useEffect(() => {
    if (!tipoRota) return;

    async function buscarAvisos() {
      try {
        const resposta = await fetch(`${AUTH_API_URL}/avisos?tipo=${tipoRota}`);
        const dados = await resposta.json();
        if (resposta.ok) setAvisos(dados);
      } catch (erro) {
        console.error("Erro ao buscar avisos:", erro);
      }
    }

    buscarAvisos();
  }, [tipoRota]);

  // fecha o dropdown ao clicar fora
  useEffect(() => {
    function aoClicarFora(evento) {
      if (containerRef.current && !containerRef.current.contains(evento.target)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  function marcarComoLido(id) {
    const novosLidos = [...lidos, id];
    setLidos(novosLidos);
    localStorage.setItem("avisosLidos", JSON.stringify(novosLidos));
  }

  function marcarTodosComoLidos() {
    const todosIds = avisos.map((a) => a.id);
    setLidos(todosIds);
    localStorage.setItem("avisosLidos", JSON.stringify(todosIds));
  }

  if (!tipoRota) return null;

  const naoLidos = avisos.filter((a) => !lidos.includes(a.id));

  function formatarData(isoString) {
    const data = new Date(isoString);
    return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  }

  return (
    <div className="notificacao-container" ref={containerRef}>
      <button
        type="button"
        className="notificacao-sino"
        onClick={() => setAberto(!aberto)}
        aria-label="Notificações"
      >
        🔔
        {naoLidos.length > 0 && (
          <span className="notificacao-badge">{naoLidos.length > 9 ? "9+" : naoLidos.length}</span>
        )}
      </button>

      {aberto && (
        <div className="notificacao-dropdown">
          <div className="notificacao-dropdown-topo">
            <span>Avisos</span>
            {naoLidos.length > 0 && (
              <button type="button" onClick={marcarTodosComoLidos}>
                Marcar tudo como lido
              </button>
            )}
          </div>

          {avisos.length === 0 && (
            <p className="notificacao-vazio">Nenhum aviso por enquanto.</p>
          )}

          <div className="notificacao-lista">
            {avisos.map((aviso) => (
              <button
                key={aviso.id}
                type="button"
                className={`notificacao-item ${lidos.includes(aviso.id) ? "notificacao-item-lido" : ""}`}
                onClick={() => marcarComoLido(aviso.id)}
              >
                <div className="notificacao-item-topo">
                  <span className="notificacao-item-titulo">{aviso.titulo}</span>
                  <span className="notificacao-item-data">{formatarData(aviso.criadoEm)}</span>
                </div>
                <p className="notificacao-item-mensagem">{aviso.mensagem}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
