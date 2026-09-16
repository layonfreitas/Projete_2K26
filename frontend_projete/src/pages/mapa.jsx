import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./mapa.css";

import BottomNav from "../components/BottomNav";
import { AUTH_API_URL } from "../config/api";

import icone from "leaflet/dist/images/marker-icon.png";
import icone2x from "leaflet/dist/images/marker-icon-2x.png";
import sombra from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconUrl: icone,
  iconRetinaUrl: icone2x,
  shadowUrl: sombra,
});

const BRASIL = [
  [-35, -75],
  [6, -32],
];

const normalizar = texto =>
  String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

function obterPontos(valor) {
  if (typeof valor === "string") {
    try {
      valor = JSON.parse(valor);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(valor)) return [];

  return valor
    .filter(
      p =>
        p?.lat != null &&
        p?.lng != null &&
        String(p.lat).trim() &&
        String(p.lng).trim()
    )
    .map(p => [Number(p.lat), Number(p.lng)])
    .filter(
      ([lat, lng]) =>
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        Math.abs(lat) <= 90 &&
        Math.abs(lng) <= 180
    );
}

export default function Mapa() {
  const navigate = useNavigate();
  const location = useLocation();

  // SOMENTE a URL solicita zoom.
  // Não usa localStorage nem location.state para escolher o alvo.
  const alvo = new URLSearchParams(location.search).get(
    "lavouraId"
  );

  const usuarioId = localStorage.getItem("usuarioId");
  const tipo = localStorage.getItem("usuarioTipo");
  const ehProdutor = tipo === "produtor";

  const container = useRef(null);
  const mapa = useRef(null);

  const pontosCadastro = useRef([]);
  const desenho = useRef(null);
  const camadaCadastro = useRef(null);
  const marcadorCidade = useRef(null);

  const [confirmado, setConfirmado] = useState(false);
  const [cidade, setCidade] = useState("");
  const [municipios, setMunicipios] = useState([]);

  const [sugestoesAbertas, setSugestoesAbertas] =
    useState(false);

  const [statusCidades, setStatusCidades] = useState(
    "Carregando cidades..."
  );

  const [aviso, setAviso] = useState("");

  const termo = normalizar(cidade.trim());

  const sugestoes =
    termo.length >= 2
      ? municipios
          .filter(m => m.busca.includes(termo))
          .slice(0, 8)
      : [];

  // ============================================================
  // DESENHO DO CADASTRO
  // ============================================================

  function redesenhar(finalizado = false) {
    if (!mapa.current || !camadaCadastro.current) return;

    if (desenho.current) {
      camadaCadastro.current.removeLayer(desenho.current);
    }

    desenho.current = null;

    const coords = pontosCadastro.current.map(
      p => p.marcador.getLatLng()
    );

    if (coords.length < 2) return;

    const estilo = {
      color: finalizado ? "#2f4a33" : "#ff0000",
      weight: 3,
      fillOpacity: 0.2,
      dashArray: finalizado ? undefined : "6 8",
    };

    desenho.current = (
      coords.length >= 3
        ? L.polygon(coords, estilo)
        : L.polyline(coords, estilo)
    ).addTo(camadaCadastro.current);
  }

  // ============================================================
  // MUNICÍPIOS
  // ============================================================

  useEffect(() => {
    const controller = new AbortController();

    async function carregar() {
      try {
        const r = await fetch(
          "https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome",
          { signal: controller.signal }
        );

        if (!r.ok) throw new Error();

        const dados = await r.json();

        if (controller.signal.aborted) return;

        setMunicipios(
          dados.map(m => {
            const uf =
              m.microrregiao?.mesorregiao?.UF?.sigla ??
              m["regiao-imediata"]?.["regiao-intermediaria"]
                ?.UF?.sigla;

            const nome = uf ? `${m.nome}, ${uf}` : m.nome;

            return {
              id: m.id,
              nome,
              busca: normalizar(nome),
            };
          })
        );

        setStatusCidades("");
      } catch {
        if (!controller.signal.aborted) {
          setStatusCidades(
            "Sugestões indisponíveis. Digite a cidade e clique em Buscar."
          );
        }
      }
    }

    carregar();

    return () => controller.abort();
  }, []);

  // ============================================================
  // INICIALIZAÇÃO DO MAPA
  // ============================================================

  useEffect(() => {
    const atual = L.map(container.current, {
      center: [-14.235, -51.9253],
      zoom: 4,
      minZoom: 4,
      maxZoom: 17,
      maxBounds: BRASIL,
      maxBoundsViscosity: 1,
    });

    mapa.current = atual;
    atual.fitBounds(BRASIL);

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Tiles © Esri",
        maxZoom: 17,
      }
    ).addTo(atual);

    camadaCadastro.current = L.layerGroup().addTo(atual);
    pontosCadastro.current = [];
    setConfirmado(false);

    if (ehProdutor) {
      atual.on("click", e => {
        const marcador = L.marker(e.latlng, {
          draggable: true,
          autoPan: true,
        }).addTo(camadaCadastro.current);

        const ponto = { marcador };
        pontosCadastro.current.push(ponto);

        const popup = document.createElement("div");
        const texto = document.createElement("p");

        const atualizarTexto = () => {
          const p = marcador.getLatLng();

          texto.textContent =
            `Lat: ${p.lat.toFixed(6)} | ` +
            `Lng: ${p.lng.toFixed(6)}`;
        };

        atualizarTexto();

        const remover = document.createElement("button");
        remover.type = "button";
        remover.textContent = "Remover ponto";

        remover.onclick = () => {
          camadaCadastro.current.removeLayer(marcador);

          pontosCadastro.current =
            pontosCadastro.current.filter(p => p !== ponto);

          setConfirmado(false);
          redesenhar();
        };

        popup.append(texto, remover);
        marcador.bindPopup(popup);

        marcador.on("dragstart", () => {
          marcador.closePopup();
        });

        marcador.on("drag", () => {
          setConfirmado(false);
          redesenhar();
        });

        marcador.on("dragend", atualizarTexto);

        setConfirmado(false);
        redesenhar();
      });
    }

    return () => {
      atual.remove();

      mapa.current = null;
      camadaCadastro.current = null;
      pontosCadastro.current = [];
      desenho.current = null;
      marcadorCidade.current = null;
    };
  }, [ehProdutor]);

  // ============================================================
  // LAVOURAS E ZOOM
  // ============================================================

  useEffect(() => {
    const atual = mapa.current;

    if (!atual) return;

    const controller = new AbortController();
    const camada = L.layerGroup().addTo(atual);

    let frame;

    setAviso("");
    atual.stop();

    // Sem ID na URL: navbar abre a visão geral.
    if (!alvo) {
      atual.fitBounds(BRASIL, { animate: false });
    }

    async function carregar() {
      if (!usuarioId) {
        setAviso(
          "Entre na sua conta para carregar as lavouras."
        );
        return;
      }

      try {
        const url =
          tipo === "agronomo"
            ? `${AUTH_API_URL}/lavouras`
            : `${AUTH_API_URL}/lavouras/${usuarioId}`;

        const r = await fetch(url, {
          signal: controller.signal,
          headers: {
            "X-Usuario-Id": usuarioId,
          },
        });

        if (!r.ok) {
          throw new Error(
            `Erro ao carregar lavouras (${r.status}).`
          );
        }

        const dados = await r.json();

        if (!Array.isArray(dados)) {
          throw new Error("Lista de lavouras inválida.");
        }

        if (
          controller.signal.aborted ||
          mapa.current !== atual
        ) {
          return;
        }

        let selecionado = null;

        for (const lavoura of dados) {
          const coords = obterPontos(lavoura.coordenadas);

          if (coords.length < 3) continue;

          const focada =
            alvo != null &&
            String(lavoura.id) === alvo;

          const poligono = L.polygon(coords, {
            color: focada ? "#ffd54f" : "#ff0000",
            weight: focada ? 4 : 3,
            fillOpacity: 0.25,
          }).addTo(camada);

          const tooltip = document.createElement("div");

          const area = Number(
            lavoura.areaHectares ??
              Number(lavoura.areaM2) / 10000
          );

          const linhas = [
            `Lavoura: ${lavoura.nomeLavoura || "Sem nome"}`,
          ];

          if (!ehProdutor && lavoura.produtorNome) {
            linhas.push(
              `Produtor: ${lavoura.produtorNome}`
            );
          }

          if (Number.isFinite(area)) {
            linhas.push(`Área: ${area.toFixed(2)} ha`);
          }

          linhas.forEach(linha => {
            const div = document.createElement("div");
            div.textContent = linha;
            tooltip.append(div);
          });

          poligono.bindTooltip(tooltip, {
            sticky: true,
            direction: "top",
          });

          if (focada) {
            selecionado = poligono;
          }
        }

        // Nenhuma solicitação de zoom: mantém a visão geral.
        if (!alvo) return;

        if (!selecionado) {
          setAviso(
            "A lavoura selecionada não foi encontrada ou não tem coordenadas válidas."
          );
          return;
        }

        // Aguarda o próximo quadro para usar o tamanho do mapa.
        frame = requestAnimationFrame(() => {
          if (
            controller.signal.aborted ||
            mapa.current !== atual
          ) {
            return;
          }

          atual.invalidateSize({ pan: false });

          atual.fitBounds(selecionado.getBounds(), {
            padding: [40, 40],
            maxZoom: 17,
            animate: false,
          });

          selecionado.bringToFront();
        });
      } catch (erro) {
        if (!controller.signal.aborted) {
          setAviso(erro.message);
          console.error(erro);
        }
      }
    }

    carregar();

    return () => {
      controller.abort();

      if (frame != null) {
        cancelAnimationFrame(frame);
      }

      if (mapa.current === atual) {
        atual.removeLayer(camada);
      }
    };
  }, [
    alvo,
    location.key,
    usuarioId,
    tipo,
    ehProdutor,
  ]);

  // ============================================================
  // BUSCA DE CIDADE
  // ============================================================

  async function buscarCidade() {
    const atual = mapa.current;

    if (!cidade.trim() || !atual) return;

    setSugestoesAbertas(false);

    try {
      const r = await fetch(
        "https://nominatim.openstreetmap.org/search" +
          "?format=json&countrycodes=br&limit=1" +
          `&q=${encodeURIComponent(cidade.trim())}`
      );

      if (!r.ok) {
        throw new Error("Erro ao buscar cidade.");
      }

      const dados = await r.json();

      if (mapa.current !== atual) return;

      if (!dados.length) {
        alert("Cidade não encontrada.");
        return;
      }

      const lat = Number(dados[0].lat);
      const lng = Number(dados[0].lon);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error("Coordenadas inválidas.");
      }

      atual.setView([lat, lng], 12);

      if (marcadorCidade.current) {
        atual.removeLayer(marcadorCidade.current);
      }

      const texto = document.createElement("div");
      texto.textContent = dados[0].display_name;

      marcadorCidade.current = L.marker([lat, lng])
        .addTo(atual)
        .bindPopup(texto)
        .openPopup();
    } catch (erro) {
      if (mapa.current === atual) {
        alert(erro.message);
      }
    }
  }

  // ============================================================
  // CONFIRMAÇÃO DO CADASTRO
  // ============================================================

  function confirmarContorno() {
    if (pontosCadastro.current.length < 3) {
      alert("Marque pelo menos 3 pontos.");
      return;
    }

    redesenhar(true);
    setConfirmado(true);
  }

  function apagarContorno() {
    setConfirmado(false);
    redesenhar();
  }

  function cadastrar() {
    if (
      !confirmado ||
      pontosCadastro.current.length < 3
    ) {
      return;
    }

    const coordenadas = pontosCadastro.current.map(p => {
      const { lat, lng } = p.marcador.getLatLng();
      return { lat, lng };
    });

    navigate("/cadastro", {
      state: { coordenadas },
    });
  }

  // ============================================================
  // TELA
  // ============================================================

  return (
    <div className="pagina-mapa">
      <div className="barra-superior">
        <div
          className="busca-cidade"
          onBlur={e => {
            if (
              !e.currentTarget.contains(e.relatedTarget)
            ) {
              setSugestoesAbertas(false);
            }
          }}
        >
          <input
            type="text"
            aria-label="Pesquisar cidade"
            aria-describedby="status-cidades"
            placeholder="Digite uma cidade..."
            autoComplete="off"
            value={cidade}
            onFocus={() => setSugestoesAbertas(true)}
            onChange={e => {
              setCidade(e.target.value);
              setSugestoesAbertas(true);
            }}
            onKeyDown={e => {
              if (e.key === "Escape") {
                setSugestoesAbertas(false);
              }

              if (e.key === "Enter") {
                e.preventDefault();
                buscarCidade();
              }

              if (e.key === "ArrowDown") {
                const botao =
                  e.currentTarget.parentElement
                    .querySelector(
                      ".sugestoes-cidades button"
                    );

                if (botao) {
                  e.preventDefault();
                  botao.focus();
                }
              }
            }}
          />

          {sugestoesAbertas && termo.length >= 2 && (
            <ul className="sugestoes-cidades">
              {sugestoes.map(m => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setCidade(m.nome);
                      setSugestoesAbertas(false);
                    }}
                  >
                    {m.nome}
                  </button>
                </li>
              ))}

              {!sugestoes.length && (
                <li className="aviso-cidades">
                  {statusCidades ||
                    "Nenhuma cidade encontrada."}
                </li>
              )}
            </ul>
          )}

          <span
            id="status-cidades"
            className="status-cidades"
            role="status"
          >
            {statusCidades}
          </span>
        </div>

        <button
          type="button"
          onClick={buscarCidade}
        >
          Buscar
        </button>

        {ehProdutor && (
          <>
            <button
              type="button"
              onClick={confirmarContorno}
            >
              Confirmar Contorno
            </button>

            <button
              type="button"
              onClick={apagarContorno}
            >
              Apagar Contorno
            </button>

            {confirmado && (
              <button
                type="button"
                className="botao-confirmar-cadastro"
                onClick={cadastrar}
              >
                Confirmar Cadastro
              </button>
            )}
          </>
        )}

        {aviso && <span role="alert">{aviso}</span>}
      </div>

      <div ref={container} id="mapa" />

      <BottomNav />
    </div>
  );
}