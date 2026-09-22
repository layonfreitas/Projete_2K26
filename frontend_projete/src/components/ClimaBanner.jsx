import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { buscarClima } from "../services/climaAPI";
import Icon from "./ui/Icon";
import Button from "./ui/Button";
import { formatarNumero } from "../utils/texto";
import "./ClimaBanner.css";

// Escolhe um ícone de acordo com a descrição do tempo (vem em português).
function iconeDoClima(condicao) {
  const texto = String(condicao || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (/trovoad|tempest/.test(texto)) return "tempestade";
  if (/chuv|garoa|pancada/.test(texto)) return "chuva";
  if (/neblina|nevoeiro|nevoa|bruma/.test(texto)) return "neblina";
  if (/poucas nuvens|parcialmente|algumas nuvens/.test(texto)) return "nuvemSol";
  if (/nublado|nuvens|encoberto/.test(texto)) return "nuvem";
  if (/limpo|ensolarado|sol/.test(texto)) return "sol";
  return "nuvemSol";
}

function capitalizar(texto) {
  const t = String(texto || "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export default function ClimaBanner({ lavouras }) {
  const navigate = useNavigate();
  const tipo = localStorage.getItem("usuarioTipo");

  const lista = Array.isArray(lavouras) ? lavouras : [];
  const [id, setId] = useState("");
  const [tentativa, setTentativa] = useState(0);

  const selecionada = lista.find((l) => String(l.id) === id) || lista[0];

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

  const pontos = (Array.isArray(coordenadas) ? coordenadas : [])
    .filter(
      (p) =>
        p?.lat != null &&
        p?.lng != null &&
        String(p.lat).trim() &&
        String(p.lng).trim()
    )
    .map((p) => ({
      lat: Number(p.lat),
      lng: Number(p.lng),
    }))
    .filter(
      (p) =>
        Number.isFinite(p.lat) &&
        Number.isFinite(p.lng) &&
        Math.abs(p.lat) <= 90 &&
        Math.abs(p.lng) <= 180
    );

  const lat = pontos.length ? pontos.reduce((s, p) => s + p.lat, 0) / pontos.length : null;

  const lng = pontos.length ? pontos.reduce((s, p) => s + p.lng, 0) / pontos.length : null;

  const chave = selecionada ? `${selecionada.id}:${lat}:${lng}:${tentativa}` : "";

  // Mantém a lavoura em foco disponível para o resto do app (o botão
  // "Observações" do cabeçalho do produtor lê estes valores).
  const selecionadaId = selecionada?.id;
  const selecionadaNome = selecionada?.nomeLavoura;

  useEffect(() => {
    if (selecionadaId == null) return;
    localStorage.setItem("lavouraId", String(selecionadaId));
    localStorage.setItem("lavouraNome", selecionadaNome || "");
  }, [selecionadaId, selecionadaNome]);

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

    localStorage.setItem("lavouraId", String(selecionada.id));
    localStorage.setItem("lavouraNome", selecionada.nomeLavoura || "");

    if (destino === "mapa") {
      // Apenas este botão envia o ID que solicita o zoom.
      navigate(`/mapa?lavouraId=${encodeURIComponent(selecionada.id)}`);
    } else {
      navigate(`/${destino}/${selecionada.id}`);
    }
  }

  if (!selecionada) return null;

  const carregando = resultado.chave !== chave;
  const clima = carregando ? null : resultado.clima;
  const erro = carregando ? "" : resultado.erro;

  const area = Number(selecionada.areaHectares ?? Number(selecionada.areaM2) / 10000);

  return (
    <section className="clima-banner" aria-label="Clima da lavoura">
      <div className="clima-banner-topo">
        <div className="clima-banner-titulo">
          <span className="clima-banner-rotulo">
            <Icon nome="pino" tamanho={14} />
            Clima agora
          </span>
          <h3>{selecionada.nomeLavoura}</h3>
        </div>

        {lista.length > 1 && (
          <select
            className="clima-banner-select"
            aria-label="Selecionar lavoura"
            value={String(selecionada.id)}
            onChange={(e) => setId(e.target.value)}
          >
            {lista.map((l) => (
              <option key={l.id} value={String(l.id)}>
                {l.nomeLavoura}
              </option>
            ))}
          </select>
        )}
      </div>

      {carregando && (
        <div className="clima-banner-principal clima-banner-carregando" role="status">
          <span className="ui-spinner" aria-hidden="true" />
          Carregando clima…
        </div>
      )}

      {erro && (
        <div className="clima-banner-erro" role="alert">
          <span>{erro}</span>
          {lat != null && (
            <Button variant="glass" size="sm" icon="atualizar" onClick={() => setTentativa((n) => n + 1)}>
              Tentar de novo
            </Button>
          )}
        </div>
      )}

      {clima && (
        <div className="clima-banner-principal">
          <Icon nome={iconeDoClima(clima.condicao)} tamanho={44} espessura={1.5} />
          <div>
            <span className="clima-banner-temperatura">
              {formatarNumero(clima.temperatura, 1)}
              <small>°C</small>
            </span>
            <span className="clima-banner-condicao">{capitalizar(clima.condicao)}</span>
          </div>
        </div>
      )}

      <dl className="clima-banner-dados">
        {clima && (
          <>
            <div>
              <dt>
                <Icon nome="gota" tamanho={15} /> Umidade
              </dt>
              <dd>{formatarNumero(clima.umidade, 0)}%</dd>
            </div>
            <div>
              <dt>
                <Icon nome="vento" tamanho={15} /> Vento
              </dt>
              <dd>{formatarNumero(clima.vento, 1)} m/s</dd>
            </div>
          </>
        )}

        <div>
          <dt>
            <Icon nome="area" tamanho={15} /> Área
          </dt>
          <dd>
            {Number.isFinite(area)
              ? `${area.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} ha`
              : "Não informada"}
          </dd>
        </div>

        {tipo === "agronomo" && selecionada.produtorNome && (
          <div>
            <dt>
              <Icon nome="usuario" tamanho={15} /> Produtor
            </dt>
            <dd>{selecionada.produtorNome}</dd>
          </div>
        )}
      </dl>

      <div className="clima-banner-acoes">
        {tipo === "agronomo" && (
          <>
            <Button variant="glass" size="sm" icon="lapis" onClick={() => abrir("observacao")}>
              Observação
            </Button>
            <Button variant="glass" size="sm" icon="documento" onClick={() => abrir("laudo")}>
              Laudo
            </Button>
            <Button variant="glass" size="sm" icon="mapa" onClick={() => abrir("mapa")}>
              Mapa
            </Button>
          </>
        )}

        {tipo === "produtor" && (
          <>
          <Button variant="glass" size="sm" icon="lapis" onClick={() => abrir("edicao")}>
            Editar lavoura
          </Button>
          <Button variant="glass" size="sm" icon="mapa" onClick={() => abrir("mapa")}>
              Mapa
            </Button>
            </>          
        )}
      </div>
    </section>
  );
}
