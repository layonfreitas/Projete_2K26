import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./mapa.css";

import BottomNav from "../components/BottomNav";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import { useToast } from "../components/ui/toastContext";
import { AUTH_API_URL } from "../config/api";
import { calcularAreaHectares, formatarHectares } from "../utils/geo";
import { mensagemDeErro } from "../services/erros";
import { contar } from "../utils/texto";

import "../utils/leafletIcons";

const BRASIL = [
  [-35, -75],
  [6, -32],
];

<<<<<<< HEAD
// =========================================================
// CALCULA A ÁREA DO CONTORNO EM HECTARES
// =========================================================
function calcularAreaHectares(pontos) {
  if (pontos.length < 10000) return 0;
=======
const normalizar = texto =>
  String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
>>>>>>> 6e57f4877ff84b071ce52406ba9a7cb38d54613a

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

const CORES_LAVOURAS = [
  "#e53935",
  "#1e88e5",
  "#43a047",
  "#8e24aa",
  "#fb8c00",
  "#00acc1",
  "#6d4c41",
  "#d81b60",
  "#3949ab",
  "#7cb342",
  "#f4511e",
  "#00897b",
];

export default function Mapa() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

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

  const [lavourasLegenda, setLavourasLegenda] = useState([]);
  const [legendaAberta, setLegendaAberta] = useState(
    () => window.innerWidth > 600
  );
  const [areaHectares, setAreaHectares] = useState(0);
  const [totalPontos, setTotalPontos] = useState(0);
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

    setAreaHectares(calcularAreaHectares(coords));
    setTotalPontos(coords.length);
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

    if (ehProdutor) {
      atual.on("click", e => {
        const marcador = L.marker(e.latlng, {
          draggable: true,
          autoPan: true,
        }).addTo(camadaCadastro.current);

        const ponto = { marcador };
        let inserir = pontosCadastro.current.length;
        if (inserir >= 3) {
          const clique = atual.latLngToLayerPoint(e.latlng);
          let distanciaMinima = Infinity;
          pontosCadastro.current.forEach((item, indice) => {
            const proximo = pontosCadastro.current[(indice + 1) % pontosCadastro.current.length];
            const distancia = L.LineUtil.pointToSegmentDistance(clique,
              atual.latLngToLayerPoint(item.marcador.getLatLng()),
              atual.latLngToLayerPoint(proximo.marcador.getLatLng()));
            if (distancia < distanciaMinima) {
              distanciaMinima = distancia;
              inserir = indice + 1;
            }
          });
        }
        pontosCadastro.current.splice(inserir, 0, ponto);

        const popup = document.createElement("div");
        const texto = document.createElement("p");
        texto.className = "mapa-popup-texto";

        const atualizarTexto = () => {
          const p = marcador.getLatLng();

          texto.textContent =
            `Lat: ${p.lat.toFixed(6)} | ` +
            `Lng: ${p.lng.toFixed(6)}`;
        };

        atualizarTexto();

        const remover = document.createElement("button");
        remover.type = "button";
        remover.className = "mapa-popup-remover";
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
    setLavourasLegenda([]);
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

        let lavourasVisiveis = dados;

if (tipo === "agronomo") {
  const respostaProdutores = await fetch(
    `${AUTH_API_URL}/agronomo/${usuarioId}/produtores`,
    {
      signal: controller.signal,
      headers: {
        "X-Usuario-Id": usuarioId,
      },
    }
  );

  if (!respostaProdutores.ok) {
    throw new Error("Erro ao carregar produtores vinculados.");
  }

  const produtoresVinculados = await respostaProdutores.json();

  const idsProdutores = produtoresVinculados.map(
    produtor => String(produtor.id)
  );

  lavourasVisiveis = dados.filter(
    lavoura =>
      idsProdutores.includes(String(lavoura.usuarioId))
  );
}

        if (
          controller.signal.aborted ||
          mapa.current !== atual
        ) {
          return;
        }

        let selecionado = null;

        if (tipo === "agronomo") {
  setLavourasLegenda([]);
}

        for (const [indice, lavoura] of lavourasVisiveis.entries()) {
          const coords = obterPontos(lavoura.coordenadas);

          if (coords.length < 3) continue;

          const focada =
            alvo != null &&
            String(lavoura.id) === alvo;

            const cor =
  focada
    ? "#ffd54f"
    : CORES_LAVOURAS[indice % CORES_LAVOURAS.length];

          const poligono = L.polygon(coords, {
            color: cor,
            weight: focada ? 4 : 3,
            fillOpacity: 0.25,
          }).addTo(camada);

          if (tipo === "agronomo") {
  setLavourasLegenda(prev => [
    ...prev,
    {
      id: lavoura.id,
      nome: lavoura.nomeLavoura || "Sem nome",
      produtor: lavoura.produtorNome || "Sem produtor",
      cor,
      poligono
    }
  ]);
}

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
        toast.info("Cidade não encontrada. Confira o nome e tente de novo.");
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
        toast.erro(mensagemDeErro(erro, "Não foi possível buscar a cidade."));
      }
    }
  }

  // ============================================================
  // CONFIRMAÇÃO DO CADASTRO
  // ============================================================

  function confirmarContorno() {
    if (pontosCadastro.current.length < 3) {
      toast.info("Marque pelo menos 3 pontos no mapa.");
      return;
    }

    redesenhar(true);
    setConfirmado(true);
  }

  function apagarContorno() {
    camadaCadastro.current?.clearLayers();
    pontosCadastro.current = [];
    desenho.current = null;
    setConfirmado(false);
    setAreaHectares(0);
    setTotalPontos(0);
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

  const instrucao = confirmado
    ? "Contorno confirmado! Continue para dar um nome à lavoura."
    : totalPontos < 3
      ? "Toque no mapa para marcar os cantos da lavoura (mínimo de 3 pontos)."
      : "Arraste os pontos para ajustar o contorno e confirme quando estiver certo.";

  return (
    <div className="pagina-mapa">
      <div className="barra-superior">
        <div
          className="busca-cidade"
          onBlur={e => {
            if (!e.currentTarget.contains(e.relatedTarget)) {
              setSugestoesAbertas(false);
            }
          }}
        >
          <Icon nome="busca" tamanho={18} />

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
                const botao = e.currentTarget.parentElement.querySelector(
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
                  {statusCidades || "Nenhuma cidade encontrada."}
                </li>
              )}
            </ul>
          )}

          <span id="status-cidades" className="status-cidades" role="status">
            {statusCidades}
          </span>
        </div>

        <Button variant="glass" icon="busca" onClick={buscarCidade}>
          Buscar
        </Button>
      </div>

      {aviso && (
        <div className="mapa-aviso" role="alert">
          <Icon nome="alertaCirculo" tamanho={18} />
          {aviso}
        </div>
      )}

      <div ref={container} id="mapa" />

      {ehProdutor && (
        <section className="mapa-painel" aria-label="Cadastro da lavoura">
          <div className="mapa-painel-topo">
            <strong>Cadastrar lavoura</strong>
            <div className="mapa-chips" aria-live="polite">
              <span>{contar(totalPontos, "ponto", "pontos")}</span>
              {totalPontos >= 3 && <span>{formatarHectares(areaHectares)}</span>}
            </div>
          </div>

          <p className="mapa-painel-texto">{instrucao}</p>

          <div className="mapa-painel-botoes">
            <Button
              variant="secondary"
              size="sm"
              icon="lixeira"
              onClick={apagarContorno}
              disabled={totalPontos === 0}
            >
              Apagar
            </Button>

            {confirmado ? (
              <Button variant="gold" size="sm" icon="avancar" onClick={cadastrar}>
                Continuar cadastro
              </Button>
            ) : (
              <Button size="sm" icon="check" onClick={confirmarContorno} disabled={totalPontos < 3}>
                Confirmar contorno
              </Button>
            )}
          </div>
        </section>
      )}

      {tipo === "agronomo" && lavourasLegenda.length > 0 && (
        <div className={"legenda-lavouras" + (legendaAberta ? "" : " recolhida")}>
          <button
            type="button"
            className="legenda-cabecalho"
            onClick={() => setLegendaAberta(aberta => !aberta)}
            aria-expanded={legendaAberta}
            aria-controls="lista-legenda"
            title={legendaAberta ? "Recolher legenda" : "Expandir legenda"}
          >
            <span className="legenda-titulo">
              Lavouras
              <small>{lavourasLegenda.length}</small>
            </span>

            <Icon nome="setaBaixo" className="legenda-seta" />
          </button>

          {legendaAberta && (
            <div id="lista-legenda" className="legenda-lista">
              {lavourasLegenda.map(lavoura => (
                <button
                  type="button"
                  key={lavoura.id}
                  className="item-legenda"
                  onClick={() => {
                    mapa.current.fitBounds(lavoura.poligono.getBounds(), {
                      padding: [40, 40],
                      maxZoom: 17,
                      animate: true,
                    });

                    lavoura.poligono.bringToFront();
                  }}
                >
                  <span className="quadrado-cor" style={{ backgroundColor: lavoura.cor }} />

                  <span className="texto-legenda">
                    <strong>{lavoura.nome}</strong>
                    <small>{lavoura.produtor}</small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <BottomNav />
    </div>
  );
}
