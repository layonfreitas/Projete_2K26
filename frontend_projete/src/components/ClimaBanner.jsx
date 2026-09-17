import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { buscarClima } from "../services/climaAPI";
import "./ClimaBanner.css";

export default function ClimaBanner({ lavouras }) {
  const navigate = useNavigate();
  const tipo = localStorage.getItem("usuarioTipo");

  const lista = Array.isArray(lavouras) ? lavouras : [];
  const [id, setId] = useState("");

  const selecionada =
    lista.find(l => String(l.id) === id) || lista[0];

  const [resultado, setResultado] = useState({
    chave: "",
    clima: null,
    erro: "",
  });

  let coordenadas = selecionada?.coordenadas;

  if (typeof coordenadas === "string") {
    try {
      coordenadas = JSON.parse(coordenadas);
    } catch {
      coordenadas = [];
    }
  }

  const pontos = (
    Array.isArray(coordenadas) ? coordenadas : []
  )
    .filter(
      p =>
        p?.lat != null &&
        p?.lng != null &&
        String(p.lat).trim() &&
        String(p.lng).trim()
    )
    .map(p => ({
      lat: Number(p.lat),
      lng: Number(p.lng),
    }))
    .filter(
      p =>
        Number.isFinite(p.lat) &&
        Number.isFinite(p.lng) &&
        Math.abs(p.lat) <= 90 &&
        Math.abs(p.lng) <= 180
    );

  const lat = pontos.length
    ? pontos.reduce((s, p) => s + p.lat, 0) / pontos.length
    : null;

  const lng = pontos.length
    ? pontos.reduce((s, p) => s + p.lng, 0) / pontos.length
    : null;

  const chave = selecionada
    ? `${selecionada.id}:${lat}:${lng}`
    : "";

  useEffect(() => {
    if (!chave) return;

    let cancelado = false;

    async function carregar() {
      if (lat == null || lng == null) {
        setResultado({
          chave,
          clima: null,
          erro: "Lavoura sem coordenadas válidas.",
        });
        return;
      }

      try {
        const clima = await buscarClima(lat, lng);

        if (!clima) {
          throw new Error("Não foi possível carregar o clima.");
        }

        if (!cancelado) {
          setResultado({ chave, clima, erro: "" });
        }
      } catch (erro) {
        if (!cancelado) {
          setResultado({
            chave,
            clima: null,
            erro: erro.message,
          });
        }
      }
    }

    carregar();

    return () => {
      cancelado = true;
    };
  }, [chave, lat, lng]);

  function abrir(destino) {
    if (!selecionada) return;

    localStorage.setItem(
      "lavouraId",
      String(selecionada.id)
    );

    localStorage.setItem(
      "lavouraNome",
      selecionada.nomeLavoura || ""
    );

    if (destino === "mapa") {
      // Apenas este botão envia o ID que solicita o zoom.
      navigate(
        `/mapa?lavouraId=${encodeURIComponent(selecionada.id)}`
      );
    } else {
      navigate(`/${destino}/${selecionada.id}`);
    }
  }

  if (!selecionada) return null;

  const carregando = resultado.chave !== chave;
  const clima = carregando ? null : resultado.clima;
  const erro = carregando ? "" : resultado.erro;

  const area = Number(
    selecionada.areaHectares ??
      Number(selecionada.areaM2) / 10000
  );

  return (
    <div className="clima-banner">
      <div className="clima-banner-topo">
        <h3>🌦️ Clima — {selecionada.nomeLavoura}</h3>

        {lista.length > 1 && (
          <select
            className="clima-banner-select"
            aria-label="Selecionar lavoura"
            value={String(selecionada.id)}
            onChange={e => setId(e.target.value)}
          >
            {lista.map(l => (
              <option key={l.id} value={String(l.id)}>
                {l.nomeLavoura}
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

      {erro && (
        <p
          className="clima-banner-status clima-banner-erro"
          role="alert"
        >
          {erro}
        </p>
      )}

      <div className="clima-banner-dados">
        {clima && (
          <>
            <span>🌡️ {clima.temperatura}°C</span>
            <span>💧 {clima.umidade}%</span>
            <span>🌬️ {clima.vento} m/s</span>
            <span>☁️ {clima.condicao}</span>
          </>
        )}

        <span>
          🌱 Área:{" "}
          {Number.isFinite(area)
            ? `${area.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} ha`
            : "Não informada"}
        </span>

        {selecionada.produtorNome && (
          <span>
            👨‍🌾 Produtor: {selecionada.produtorNome}
          </span>
        )}
      </div>

      <div className="clima-banner-acoes">
        {tipo === "agronomo" && (
          <>
            <button
              type="button"
              className="acao-secundaria"
              onClick={() => abrir("observacao")}
            >
              📝 <span>Observação</span>
            </button>

            <button
              type="button"
              className="acao-secundaria"
              onClick={() => abrir("laudo")}
            >
              📄 <span>Laudo</span>
            </button>

            <button
              type="button"
              className="acao-secundaria"
              onClick={() => abrir("mapa")}
            >
              🗺️ <span>Mapa</span>
            </button>
          </>
        )}

        {tipo === "produtor" && (
          <button
            type="button"
            className="acao-secundaria"
            onClick={() => abrir("edicao")}
          >
            ✏️ <span>Editar</span>
          </button>
        )}
      </div>
    </div>
  );
}