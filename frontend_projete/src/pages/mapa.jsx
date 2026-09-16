import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./mapa.css";

import BottomNav from "../components/BottomNav";
import { AUTH_API_URL } from "../config/api";

import iconeMarcador from "leaflet/dist/images/marker-icon.png";
import iconeMarcador2x from "leaflet/dist/images/marker-icon-2x.png";
import iconeSombra from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: iconeMarcador2x,
  iconUrl: iconeMarcador,
  shadowUrl: iconeSombra,
});

function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function obterPontos(coordenadas) {
  if (!Array.isArray(coordenadas)) return [];

  return coordenadas
    .filter(
      (ponto) =>
        ponto?.lat != null &&
        ponto?.lng != null &&
        String(ponto.lat).trim() !== "" &&
        String(ponto.lng).trim() !== ""
    )
    .map((ponto) => [
      Number(ponto.lat),
      Number(ponto.lng),
    ])
    .filter(
      ([lat, lng]) =>
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
    );
}

export default function Mapa() {
  const navigate = useNavigate();
  const location = useLocation();

  const focarLavouraId = location.state?.focarLavouraId;

  const usuarioId = localStorage.getItem("usuarioId");
  const usuarioTipo = localStorage.getItem("usuarioTipo");
  const ehProdutor = usuarioTipo === "produtor";

  const mapaRef = useRef(null);
  const map = useRef(null);

  const postos = useRef([]);
  const contadorPostos = useRef(0);

  const contornoLavoura = useRef(null);
  const previewLavoura = useRef(null);
  const marcadorCidade = useRef(null);

  const [cidade, setCidade] = useState("");
  const [contornoCriado, setContornoCriado] = useState(false);
  const [municipios, setMunicipios] = useState([]);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);

  const [statusMunicipios, setStatusMunicipios] = useState(
    "Carregando cidades..."
  );

  const [erroLavouras, setErroLavouras] = useState("");

  const termo = normalizar(cidade.trim());

  const sugestoes =
    termo.length >= 2
      ? municipios
          .filter((item) => item.busca.includes(termo))
          .slice(0, 8)
      : [];

  // ============================================================
  // MUNICÍPIOS
  // ============================================================

  useEffect(() => {
    const controller = new AbortController();

    async function carregarMunicipios() {
      try {
        const resposta = await fetch(
          "https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome",
          { signal: controller.signal }
        );

        if (!resposta.ok) {
          throw new Error("Falha ao carregar municípios.");
        }

        const dados = await resposta.json();

        if (controller.signal.aborted) return;

        setMunicipios(
          dados.map((item) => {
            const uf =
              item.microrregiao?.mesorregiao?.UF?.sigla ??
              item["regiao-imediata"]?.["regiao-intermediaria"]
                ?.UF?.sigla;

            const nome = uf
              ? `${item.nome}, ${uf}`
              : item.nome;

            return {
              id: item.id,
              nome,
              busca: normalizar(nome),
            };
          })
        );

        setStatusMunicipios("");
      } catch (erro) {
        if (!controller.signal.aborted) {
          setStatusMunicipios(
            "Sugestões indisponíveis. Digite a cidade e clique em Buscar."
          );
        }
      }
    }

    carregarMunicipios();

    return () => controller.abort();
  }, []);

  // ============================================================
  // CRIAÇÃO DO MAPA
  // ============================================================

  useEffect(() => {
    if (map.current || !mapaRef.current) return;

    const limitesBrasil = L.latLngBounds(
      [-35.0, -75.0],
      [6.0, -32.0]
    );

    const mapaAtual = L.map(mapaRef.current, {
      center: [-14.235, -51.9253],
      zoom: 4,
      minZoom: 4,
      maxZoom: 17,
      maxBounds: limitesBrasil,
      maxBoundsViscosity: 1.0,
      zoomControl: true,
    });

    map.current = mapaAtual;

    postos.current = [];
    contadorPostos.current = 0;
    contornoLavoura.current = null;
    previewLavoura.current = null;
    marcadorCidade.current = null;

    setContornoCriado(false);

    mapaAtual.fitBounds(limitesBrasil);

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Tiles © Esri",
        maxZoom: 17,
      }
    ).addTo(mapaAtual);

    if (ehProdutor) {
      mapaAtual.on("click", (evento) => {
        const id = ++contadorPostos.current;
        const { lat, lng } = evento.latlng;

        const marcador = L.marker([lat, lng], {
          draggable: true,
          autoPan: true,
        }).addTo(mapaAtual);

        function conteudoPopup() {
          const posicao = marcador.getLatLng();
          const conteudo = document.createElement("div");

          const titulo = document.createElement("strong");
          titulo.textContent = `Posto ${id}`;

          const latitude = document.createElement("div");
          latitude.textContent =
            `Lat: ${posicao.lat.toFixed(6)}`;

          const longitude = document.createElement("div");
          longitude.textContent =
            `Lng: ${posicao.lng.toFixed(6)}`;

          const botao = document.createElement("button");
          botao.type = "button";
          botao.textContent = "Remover";
          botao.addEventListener("click", () => removerPosto(id));

          conteudo.append(titulo, latitude, longitude, botao);

          return conteudo;
        }

        marcador.bindPopup(conteudoPopup());

        postos.current.push({
          id,
          marcador,
          lat,
          lng,
        });

        marcador.on("dragstart", () => {
          marcador.closePopup();
        });

        marcador.on("drag", () => {
          const ponto = postos.current.find(
            (item) => item.id === id
          );

          if (!ponto) return;

          const posicao = marcador.getLatLng();

          ponto.lat = posicao.lat;
          ponto.lng = posicao.lng;

          if (contornoLavoura.current) {
            contornoLavoura.current.setLatLngs(
              postos.current.map((item) => [
                item.lat,
                item.lng,
              ])
            );
          } else {
            atualizarPreview();
          }
        });

        marcador.on("dragend", () => {
          marcador.setPopupContent(conteudoPopup());
        });

        if (contornoLavoura.current) {
          contornoLavoura.current.setLatLngs(
            postos.current.map((item) => [
              item.lat,
              item.lng,
            ])
          );
        } else {
          atualizarPreview();
        }
      });
    }

    return () => {
      mapaAtual.remove();

      if (map.current === mapaAtual) {
        map.current = null;
        postos.current = [];
        contadorPostos.current = 0;
        contornoLavoura.current = null;
        previewLavoura.current = null;
        marcadorCidade.current = null;
      }
    };
  }, [ehProdutor]);

  // ============================================================
  // CARREGA LAVOURAS E APLICA O ZOOM NA SELECIONADA
  // ============================================================

  useEffect(() => {
    const mapaAtual = map.current;

    if (!mapaAtual || !usuarioId) return;

    const controller = new AbortController();
    const camada = L.layerGroup().addTo(mapaAtual);

    setErroLavouras("");

    async function carregarLavouras() {
      const url =
        usuarioTipo === "agronomo"
          ? `${AUTH_API_URL}/lavouras`
          : `${AUTH_API_URL}/lavouras/${usuarioId}`;

      try {
        const resposta = await fetch(url, {
          signal: controller.signal,
          headers: {
            "X-Usuario-Id": usuarioId,
          },
        });

        if (!resposta.ok) {
          throw new Error(
            `Não foi possível carregar as lavouras (${resposta.status}).`
          );
        }

        const dados = await resposta.json();

        if (!Array.isArray(dados)) {
          throw new Error("A lista de lavouras é inválida.");
        }

        if (
          controller.signal.aborted ||
          map.current !== mapaAtual
        ) {
          return;
        }

        const lavouraIdSalva =
          localStorage.getItem("lavouraId");

        const idFiltro = focarLavouraId ?? lavouraIdSalva;

        const lavourasVisiveis =
          ehProdutor && idFiltro != null
            ? dados.filter(
                (lavoura) =>
                  String(lavoura.id) === String(idFiltro)
              )
            : dados;

        let poligonoSelecionado = null;

        for (const lavoura of lavourasVisiveis) {
          const pontos = obterPontos(lavoura.coordenadas);

          if (pontos.length < 3) continue;

          const selecionada =
            focarLavouraId != null &&
            String(lavoura.id) === String(focarLavouraId);

          const poligono = L.polygon(pontos, {
            color: selecionada ? "#ffd54f" : "#ff0000",
            weight: selecionada ? 4 : 3,
            fillColor: selecionada ? "#ffd54f" : "#ff0000",
            fillOpacity: 0.3,
          }).addTo(camada);

          const area = Number(
            lavoura.areaHectares ??
              Number(lavoura.areaM2) / 10000
          );

          const tooltip = document.createElement("div");

          function adicionarLinha(rotulo, valor) {
            const linha = document.createElement("div");
            const titulo = document.createElement("strong");

            titulo.textContent = `${rotulo}: `;
            linha.append(
              titulo,
              document.createTextNode(String(valor))
            );

            tooltip.appendChild(linha);
          }

          adicionarLinha(
            "Lavoura",
            lavoura.nomeLavoura || "Sem nome"
          );

          if (!ehProdutor && lavoura.produtorNome) {
            adicionarLinha("Produtor", lavoura.produtorNome);
          }

          adicionarLinha(
            "Área",
            Number.isFinite(area)
              ? `${area.toFixed(2)} ha`
              : "Não informada"
          );

          poligono.bindTooltip(tooltip, {
            sticky: true,
            direction: "top",
          });

          if (selecionada) {
            poligonoSelecionado = poligono;
          }
        }

        if (focarLavouraId != null) {
          if (!poligonoSelecionado) {
            setErroLavouras(
              "A lavoura selecionada não foi encontrada ou está sem coordenadas válidas."
            );
            return;
          }

          const limites = poligonoSelecionado.getBounds();

          if (limites.isValid()) {
            mapaAtual.invalidateSize({ pan: false });

            mapaAtual.fitBounds(limites, {
              padding: [40, 40],
              maxZoom: 17,
              animate: false,
            });

            poligonoSelecionado.bringToFront();
          }
        }
      } catch (erro) {
        if (!controller.signal.aborted) {
          console.error("Erro ao carregar lavouras:", erro);
          setErroLavouras(erro.message);
        }
      }
    }

    carregarLavouras();

    return () => {
      controller.abort();

      if (map.current === mapaAtual) {
        mapaAtual.removeLayer(camada);
      }
    };
  }, [usuarioId, usuarioTipo, ehProdutor, focarLavouraId]);

  // ============================================================
  // PRÉVIA DO CONTORNO
  // ============================================================

  function atualizarPreview() {
    const mapaAtual = map.current;

    if (!mapaAtual) return;

    if (previewLavoura.current) {
      mapaAtual.removeLayer(previewLavoura.current);
      previewLavoura.current = null;
    }

    if (postos.current.length < 2) return;

    const coordenadas = postos.current.map((ponto) => [
      ponto.lat,
      ponto.lng,
    ]);

    const estilo = {
      color: "#ff0000",
      weight: 3,
      dashArray: "6 8",
      fillColor: "#ff0000",
      fillOpacity: 0.12,
    };

    previewLavoura.current =
      postos.current.length === 2
        ? L.polyline(coordenadas, estilo).addTo(mapaAtual)
        : L.polygon(coordenadas, estilo).addTo(mapaAtual);
  }

  function removerPosto(id) {
    const mapaAtual = map.current;

    if (!mapaAtual) return;

    const indice = postos.current.findIndex(
      (ponto) => ponto.id === id
    );

    if (indice === -1) return;

    mapaAtual.removeLayer(postos.current[indice].marcador);
    postos.current.splice(indice, 1);

    if (contornoLavoura.current) {
      mapaAtual.removeLayer(contornoLavoura.current);
      contornoLavoura.current = null;
      setContornoCriado(false);
    }

    atualizarPreview();
  }

  // ============================================================
  // BUSCA DE CIDADE
  // ============================================================

  async function buscarCidade() {
    const mapaAtual = map.current;
    const nomeCidade = cidade.trim();

    if (!nomeCidade || !mapaAtual) return;

    setMostrarSugestoes(false);

    try {
      const url =
        "https://nominatim.openstreetmap.org/search" +
        "?format=json&countrycodes=br&limit=1" +
        `&q=${encodeURIComponent(nomeCidade)}`;

      const resposta = await fetch(url);

      if (!resposta.ok) {
        throw new Error("Falha ao buscar cidade.");
      }

      const dados = await resposta.json();

      if (map.current !== mapaAtual) return;

      if (!Array.isArray(dados) || dados.length === 0) {
        alert("Cidade não encontrada.");
        return;
      }

      const lat = Number(dados[0].lat);
      const lng = Number(dados[0].lon);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error("Coordenadas da cidade inválidas.");
      }

      mapaAtual.setView([lat, lng], 12);

      if (marcadorCidade.current) {
        mapaAtual.removeLayer(marcadorCidade.current);
      }

      const popup = document.createElement("div");
      popup.textContent = dados[0].display_name;

      marcadorCidade.current = L.marker([lat, lng])
        .addTo(mapaAtual)
        .bindPopup(popup)
        .openPopup();
    } catch (erro) {
      if (map.current === mapaAtual) {
        console.error("Erro ao buscar cidade:", erro);
        alert("Erro ao buscar cidade.");
      }
    }
  }

  // ============================================================
  // CADASTRO DO CONTORNO
  // ============================================================

  function confirmarContorno() {
    const mapaAtual = map.current;

    if (!mapaAtual) return;

    if (postos.current.length < 3) {
      alert("Marque pelo menos 3 pontos.");
      return;
    }

    if (contornoLavoura.current) {
      mapaAtual.removeLayer(contornoLavoura.current);
    }

    if (previewLavoura.current) {
      mapaAtual.removeLayer(previewLavoura.current);
      previewLavoura.current = null;
    }

    const coordenadas = postos.current.map((ponto) => [
      ponto.lat,
      ponto.lng,
    ]);

    contornoLavoura.current = L.polygon(coordenadas, {
      color: "#2f4a33",
      weight: 3,
      fillColor: "#2f4a33",
      fillOpacity: 0.3,
    }).addTo(mapaAtual);

    setContornoCriado(true);
  }

  function apagarContorno() {
    const mapaAtual = map.current;

    if (!mapaAtual) return;

    if (!contornoLavoura.current) {
      alert("Nenhum contorno desenhado.");
      return;
    }

    mapaAtual.removeLayer(contornoLavoura.current);
    contornoLavoura.current = null;

    setContornoCriado(false);
    atualizarPreview();
  }

  function confirmarCadastro() {
    if (
      !contornoLavoura.current ||
      postos.current.length < 3
    ) {
      alert(
        "Confirme um contorno com pelo menos 3 pontos antes de cadastrar."
      );
      return;
    }

    const coordenadas = postos.current.map((ponto) => ({
      lat: ponto.lat,
      lng: ponto.lng,
    }));

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
          onBlur={(evento) => {
            if (
              !evento.currentTarget.contains(
                evento.relatedTarget
              )
            ) {
              setMostrarSugestoes(false);
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
            onFocus={() => setMostrarSugestoes(true)}
            onChange={(evento) => {
              setCidade(evento.target.value);
              setMostrarSugestoes(true);
            }}
            onKeyDown={(evento) => {
              if (evento.key === "Escape") {
                setMostrarSugestoes(false);
              }

              if (evento.key === "ArrowDown") {
                const primeira =
                  evento.currentTarget.parentElement
                    .querySelector(
                      ".sugestoes-cidades button"
                    );

                if (primeira) {
                  evento.preventDefault();
                  primeira.focus();
                }
              }

              if (evento.key === "Enter") {
                evento.preventDefault();
                buscarCidade();
              }
            }}
          />

          {mostrarSugestoes && termo.length >= 2 && (
            <ul
              className="sugestoes-cidades"
              aria-label="Sugestões de cidades"
            >
              {sugestoes.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setCidade(item.nome);
                      setMostrarSugestoes(false);
                    }}
                  >
                    {item.nome}
                  </button>
                </li>
              ))}

              {sugestoes.length === 0 && (
                <li className="aviso-cidades">
                  {statusMunicipios ||
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
            {statusMunicipios}
          </span>
        </div>

        <button type="button" onClick={buscarCidade}>
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

            {contornoCriado && (
              <button
                type="button"
                className="botao-confirmar-cadastro"
                onClick={confirmarCadastro}
              >
                Confirmar Cadastro
              </button>
            )}
          </>
        )}

        {erroLavouras && (
          <span role="alert">{erroLavouras}</span>
        )}
      </div>

      <div ref={mapaRef} id="mapa"></div>

      <BottomNav />
    </div>
  );
}