import { useState, useEffect } from "react";
import { buscarClima } from "../services/climaAPI";
import "./ClimaBanner.css";
import { useNavigate } from "react-router-dom";

// calcula o centro aproximado do polígono da lavoura
function centroide(coordenadas) {
  const soma = coordenadas.reduce(
    (acc, ponto) => ({
      lat: acc.lat + ponto.lat,
      lng: acc.lng + ponto.lng,
    }),
    { lat: 0, lng: 0 }
  );

  return {
    lat: soma.lat / coordenadas.length,
    lng: soma.lng / coordenadas.length,
  };
}

function ClimaBanner({ lavouras }) {
  const [lavouraId, setLavouraId] = useState(null);

  const [clima, setClima] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const produtorSelecionadoNome =
    localStorage.getItem("produtorSelecionadoNome");

  const usuarioTipo = localStorage.getItem("usuarioTipo");

  const navigate = useNavigate();

  // Seleciona a primeira lavoura quando a lista chega
  useEffect(() => {
    if (lavouras && lavouras.length > 0 && lavouraId === null) {
      const lavoura = lavouras[0];

      setLavouraId(lavoura.id);

      localStorage.setItem("lavouraId", lavoura.id);
      localStorage.setItem("lavouraNome", lavoura.nomeLavoura);
    }
  }, [lavouras, lavouraId]);

  // Descobre qual objeto representa a lavoura selecionada
  const lavouraSelecionada = lavouras?.find(
    (lavoura) => lavoura.id === lavouraId
  );

  // Ir para observações
  function observacao() {
    if (!lavouraSelecionada) return;

    navigate(`/observacao/${lavouraSelecionada.id}`);
  }

  // Ir para o laudo
  function laudo() {
    if (!lavouraSelecionada) return;

    // Salva os dados da lavoura selecionada
    localStorage.setItem("lavouraId", lavouraSelecionada.id);
    localStorage.setItem(
      "lavouraNome",
      lavouraSelecionada.nomeLavoura
    );

    navigate(`/laudo/${lavouraSelecionada.id}`);
  }

  // Busca o clima da lavoura selecionada
  useEffect(() => {
    if (!lavouraSelecionada?.coordenadas?.length) return;

    async function carregarClima() {
      setCarregando(true);
      setErro("");

      try {
        const { lat, lng } = centroide(
          lavouraSelecionada.coordenadas
        );

        const dados = await buscarClima(lat, lng);

        setClima(dados);
      } catch (erroRequisicao) {
        setErro(
          erroRequisicao.message ||
            "Erro ao conectar com o serviço de clima."
        );

        console.error(erroRequisicao);
      } finally {
        setCarregando(false);
      }
    }

    carregarClima();
  }, [lavouraSelecionada?.id]);

  // Se não houver lavouras, não mostra o banner
  if (!lavouras || lavouras.length === 0) {
    return null;
  }

  return (
    <div className="clima-banner">

      <div className="clima-banner-topo">

        <h3>
          🌦️ Clima{" "}
          {lavouraSelecionada
            ? `— ${lavouraSelecionada.nomeLavoura}`
            : ""}
        </h3>

        {lavouras.length > 1 && (
          <select
            className="clima-banner-select"
            value={lavouraId ?? ""}
            onChange={(evento) => {
              const id = Number(evento.target.value);

              const lavoura = lavouras.find(
                (l) => l.id === id
              );

              if (!lavoura) return;

              setLavouraId(id);

              localStorage.setItem("lavouraId", id);
              localStorage.setItem(
                "lavouraNome",
                lavoura.nomeLavoura
              );
            }}
          >
            {lavouras.map((lavoura) => (
              <option
                key={lavoura.id}
                value={lavoura.id}
              >
                {lavoura.nomeLavoura}
              </option>
            ))}
          </select>
        )}

      </div>

      {carregando && (
        <p className="clima-banner-status">
          Carregando clima...
        </p>
      )}

      {!carregando && erro && (
        <p className="clima-banner-status clima-banner-erro">
          {erro}
        </p>
      )}

      {!carregando && !erro && clima && (
        <div className="clima-banner-dados">

          <span>
            🌡️ {clima.temperatura}°C
          </span>

          <span>
            💧 {clima.umidade}%
          </span>

          <span>
            🌬️ {clima.vento} m/s
          </span>

          <span>
            ☁️ {clima.condicao}
          </span>

          {produtorSelecionadoNome && (
            <span>
              👨‍🌾 Produtor: {produtorSelecionadoNome}
            </span>
          )}

          {usuarioTipo === "agronomo" && (
            <button
              type="button"
              onClick={observacao}
            >
              adicionar observação
            </button>
          )}

          {usuarioTipo === "agronomo" && (
            <button
              type="button"
              onClick={laudo}
            >
              emitir laudo
            </button>
          )}

        </div>
      )}

    </div>
  );
}

export default ClimaBanner;