import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { buscarClima } from "../services/climaAPI";
import "./ClimaBanner.css";

function centroide(coordenadas) {
  if (!Array.isArray(coordenadas)) return null;

  const pontos = coordenadas
    .filter(
      (ponto) =>
        ponto?.lat != null &&
        ponto?.lng != null &&
        String(ponto.lat).trim() !== "" &&
        String(ponto.lng).trim() !== ""
    )
    .map((ponto) => ({
      lat: Number(ponto.lat),
      lng: Number(ponto.lng),
    }))
    .filter(
      (ponto) =>
        Number.isFinite(ponto.lat) &&
        Number.isFinite(ponto.lng) &&
        ponto.lat >= -90 &&
        ponto.lat <= 90 &&
        ponto.lng >= -180 &&
        ponto.lng <= 180
    );

  if (pontos.length === 0) return null;

  const soma = pontos.reduce(
    (total, ponto) => ({
      lat: total.lat + ponto.lat,
      lng: total.lng + ponto.lng,
    }),
    { lat: 0, lng: 0 }
  );

  return {
    lat: soma.lat / pontos.length,
    lng: soma.lng / pontos.length,
  };
}

export default function ClimaBanner({ lavouras }) {
  const navigate = useNavigate();

  const listaLavouras = Array.isArray(lavouras)
    ? lavouras
    : [];

  const usuarioTipo = localStorage.getItem("usuarioTipo");

  const [lavouraId, setLavouraId] = useState(null);

  const [estadoClima, setEstadoClima] = useState({
    chave: "",
    clima: null,
    carregando: false,
    erro: "",
  });

  const lavouraSelecionada =
    listaLavouras.find(
      (lavoura) => String(lavoura.id) === String(lavouraId)
    ) ??
    listaLavouras[0] ??
    null;

  const idSelecionado = lavouraSelecionada?.id;
  const nomeSelecionado = lavouraSelecionada?.nomeLavoura;

  // Mantém a seleção válida quando a lista de lavouras muda.
  useEffectEffect(() => {
    if (idSelecionado == null) {
      setLavouraId(null);
      return;
    }

    setLavouraId(String(idSelecionado));

    localStorage.setItem(
      "lavouraId",
      String(idSelecionado)
    );

    localStorage.setItem(
      "lavouraNome",
      nomeSelecionado || ""
    );
  }, [idSelecionado, nomeSelecionado]);

  const centro = centroide(
    lavouraSelecionada?.coordenadas
  );

  const latitude = centro?.lat;
  const longitude = centro?.lng;

  const chaveClima =
    idSelecionado == null
      ? ""
      : `${idSelecionado}:${latitude}:${longitude}`;

  // Busca o clima e ignora respostas de uma seleção anterior.
  useEffect(() => {
    let cancelado = false;

    if (idSelecionado == null) return;

    if (latitude == null || longitude == null) {
      setEstadoClima({
        chave: chaveClima,
        clima: null,
        carregando: false,
        erro: "A lavoura está sem coordenadas válidas.",
      });

      return;
    }

    async function carregarClima() {
      setEstadoClima({
        chave: chaveClima,
        clima: null,
        carregando: true,
        erro: "",
      });

      try {
        const dados = await buscarClima(
          latitude,
          longitude
        );

        if (cancelado) return;

        if (!dados) {
          throw new Error(
            "Não foi possível obter o clima desta lavoura."
          );
        }

        setEstadoClima({
          chave: chaveClima,
          clima: dados,
          carregando: false,
          erro: "",
        });
      } catch (erro) {
        if (cancelado) return;

        setEstadoClima({
          chave: chaveClima,
          clima: null,
          carregando: false,
          erro:
            erro.message ||
            "Erro ao conectar com o serviço de clima.",
        });
      }
    }

    carregarClima();

    return () => {
      cancelado = true;
    };
  }, [idSelecionado, latitude, longitude, chaveClima]);

  function salvarSelecao() {
    if (!lavouraSelecionada) return;

    localStorage.setItem(
      "lavouraId",
      String(lavouraSelecionada.id)
    );

    localStorage.setItem(
      "lavouraNome",
      lavouraSelecionada.nomeLavoura || ""
    );
  }

  function observacao() {
    if (!lavouraSelecionada) return;

    salvarSelecao();

    navigate(
      `/observacao/${lavouraSelecionada.id}`
    );
  }

  function laudo() {
    if (!lavouraSelecionada) return;

    salvarSelecao();

    navigate(`/laudo/${lavouraSelecionada.id}`);
  }

  function visualizarLavoura() {
    if (!lavouraSelecionada) return;

    salvarSelecao();

    navigate("/mapa", {
      state: {
        focarLavouraId: lavouraSelecionada.id,
      },
    });
  }

  function editarLavoura() {
    if (!lavouraSelecionada) return;

    salvarSelecao();

    navigate(`/edicao/${lavouraSelecionada.id}`);
  }

  if (!lavouraSelecionada) {
    return null;
  }

  const climaAtual =
    estadoClima.chave === chaveClima
      ? estadoClima
      : {
          clima: null,
          carregando: true,
          erro: "",
        };

  const { clima, carregando, erro } = climaAtual;

  const area = Number(
    lavouraSelecionada.areaHectares ??
      Number(lavouraSelecionada.areaM2) / 10000
  );

  const areaFormatada = Number.isFinite(area)
    ? `${area.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} ha`
    : "Não informada";

  return (
    <div className="clima-banner">
      <div className="clima-banner-topo">
        <h3>
          🌦️ Clima — {lavouraSelecionada.nomeLavoura}
        </h3>

        {listaLavouras.length > 1 && (
          <select
            className="clima-banner-select"
            aria-label="Selecionar lavoura"
            value={String(lavouraSelecionada.id)}
            onChange={(evento) => {
              setLavouraId(evento.target.value);
            }}
          >
            {listaLavouras.map((lavoura) => (
              <option
                key={lavoura.id}
                value={String(lavoura.id)}
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
        <p
          className="clima-banner-status clima-banner-erro"
          role="alert"
        >
          🌤️ {erro}
        </p>
      )}

      <div className="clima-banner-dados">
        {!carregando && !erro && clima && (
          <>
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
          </>
        )}

        <span>
          🌱 Área: {areaFormatada}
        </span>

        {lavouraSelecionada.produtorNome && (
          <span>
            👨‍🌾 Produtor:{" "}
            {lavouraSelecionada.produtorNome}
          </span>
        )}
      </div>

           <div className="clima-banner-acoes">
        {usuarioTipo === "agronomo" && (
          <>
            <button
              type="button"
              className="acao-secundaria"
              onClick={observacao}
              title="Adicionar observação"
            >
              📝 <span>Observação</span>
            </button>

            <button
              type="button"
              className="acao-secundaria"
              onClick={laudo}
              title="Emitir laudo"
            >
              📄 <span>Laudo</span>
            </button>

            <button
              type="button"
              className="acao-secundaria"
              onClick={visualizarLavoura}
              title="Visualizar lavoura no mapa"
            >
              🗺️ <span>Mapa</span>
            </button>
          </>
        )}

        {usuarioTipo === "produtor" && (
          <button
            type="button"
            className="acao-secundaria"
            onClick={editarLavoura}
            title="Editar lavoura"
          >
            ✏️ <span>Editar</span>
          </button>
        )}
      </div>
    </div>
  );
}