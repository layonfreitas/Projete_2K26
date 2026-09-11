import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { AUTH_API_URL } from "../config/api";

function obterUsuarioId() {
  return localStorage.getItem("usuarioTipo") === "agronomo"
    ? localStorage.getItem("produtorSelecionadoId")
    : localStorage.getItem("usuarioId");
}

function removerCamada(mapa, ref) {
  if (ref.current) mapa.removeLayer(ref.current);
  ref.current = null;
}

export default function Mapas() {
  const mapaRef = useRef(null);
  const map = useRef(null);
  const overlayAtual = useRef(null);
  const contornoAtual = useRef(null);
  const [lavouras, setLavouras] = useState([]);
  const [lavouraSelecionada, setLavouraSelecionada] = useState(null);
  const [imagens, setImagens] = useState([]);
  const [imagensLavouraId, setImagensLavouraId] = useState(null);
  const [dataSelecionada, setDataSelecionada] = useState(null);
  const [indicesSelecionados, setIndicesSelecionados] = useState({});
  const [indiceVisualizacao, setIndiceVisualizacao] = useState("indice");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const usuarioId = obterUsuarioId();
  const indiceSelecionado = indicesSelecionados[dataSelecionada];

  useEffect(() => {
    const mapa = L.map(mapaRef.current, {
      center: [-14.2350, -51.9253], zoom: 4, minZoom: 4,
      maxBounds: L.latLngBounds([-35, -75], [6, -32]),
      maxBoundsViscosity: 1.0,
    });
    map.current = mapa;
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { attribution: "Tiles © Esri" }
    ).addTo(mapa);
    return () => {
      mapa.remove();
      map.current = null;
      overlayAtual.current = null;
      contornoAtual.current = null;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function carregar() {
      if (!usuarioId) {
        setErro("Usuário não identificado.");
        return;
      }
      try {
        const resposta = await fetch(`${AUTH_API_URL}/lavouras/${usuarioId}`, {
          signal: controller.signal,
        });
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.mensagem || "Erro ao buscar lavouras.");
        if (controller.signal.aborted) return;
        setLavouras(dados);
        setLavouraSelecionada(dados[0] || null);
      } catch (e) {
        if (!controller.signal.aborted) setErro(e.message);
      }
    }
    carregar();
    return () => controller.abort();
  }, [usuarioId]);

  useEffect(() => {
    const controller = new AbortController();
    const mapa = map.current;
    setImagens([]);
    setImagensLavouraId(null);
    setDataSelecionada(null);
    setIndicesSelecionados({});
    setErro(null);
    setCarregando(false);
    if (mapa) {
      removerCamada(mapa, overlayAtual);
      removerCamada(mapa, contornoAtual);
      if (lavouraSelecionada) {
        try {
          const raw = lavouraSelecionada.coordenadas;
          const pontos = typeof raw === "string" ? JSON.parse(raw) : raw;
          if (pontos?.length >= 3) {
            contornoAtual.current = L.polygon(
              pontos.map(p => [Number(p.lat), Number(p.lng)]),
              { color: "#2f4a33", weight: 2, fill: false }
            ).addTo(mapa);
            mapa.fitBounds(contornoAtual.current.getBounds(), { padding: [30, 30] });
          }
        } catch {
          setErro("Não foi possível desenhar o contorno atual da lavoura.");
        }
      }
    }
    async function carregar() {
      if (!lavouraSelecionada) return;
      try {
        const resposta = await fetch(
          `${AUTH_API_URL}/imagens/${lavouraSelecionada.id}?usuario_id=${usuarioId}`,
          { signal: controller.signal }
        );
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.mensagem || "Erro ao buscar histórico.");
        if (controller.signal.aborted) return;
        const selecoes = {};
        dados.forEach(imagem => {
          const indice = imagem.indicesDisponiveis.find(i => !i.startsWith("z-score-"));
          if (indice) selecoes[imagem.data] = indice;
        });
        setImagens(dados);
        setIndicesSelecionados(selecoes);
        setDataSelecionada(dados[0]?.data || null);
        setImagensLavouraId(lavouraSelecionada.id);
      } catch (e) {
        if (!controller.signal.aborted) setErro(e.message);
      }
    }
    carregar();
    return () => controller.abort();
  }, [lavouraSelecionada, usuarioId]);

  useEffect(() => {
    const mapa = map.current;
    if (!mapa || !lavouraSelecionada || imagensLavouraId !== lavouraSelecionada.id
        || !dataSelecionada || !indiceSelecionado) return;
    const controller = new AbortController();
    let overlay;
    removerCamada(mapa, overlayAtual);
    setCarregando(true);
    setErro(null);
    async function carregar() {
      try {
        const parametros = new URLSearchParams({
          id: lavouraSelecionada.id, usuario_id: usuarioId, data: dataSelecionada,
          indice: indiceVisualizacao === "indice" ? indiceSelecionado : `z-score-${indiceSelecionado}`,
        });
        const resposta = await fetch(`${AUTH_API_URL}/acessar_imagem?${parametros}`, {
          signal: controller.signal,
        });
        const dados = await resposta.json();
        if (controller.signal.aborted) return;
        if (!resposta.ok) throw new Error(dados.mensagem || "Imagem não encontrada.");
        const meta = dados.georreferencia;
        if (!meta) {
          throw new Error("Esta imagem antiga precisa ser reprocessada para aparecer na posição correta.");
        }
        if (meta.versao !== 1 || meta.crs !== "EPSG:3857"
            || Number(meta.lavouraId) !== Number(lavouraSelecionada.id)
            || Number(meta.usuarioId) !== Number(usuarioId)) {
          throw new Error("Os dados de localização da imagem não correspondem à lavoura.");
        }
        const b = meta.bounds;
        if (!Array.isArray(b) || b.length !== 2
            || !b.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))
            || !(b[0][0] > -85 && b[0][0] < b[1][0] && b[1][0] < 85)
            || !(b[0][1] >= -180 && b[0][1] < b[1][1] && b[1][1] <= 180)
            || meta.geometria?.type !== "Polygon") {
          throw new Error("A imagem possui limites geográficos inválidos.");
        }
        const bounds = L.latLngBounds(b);
        // O contorno é o utilizado na geração, mesmo que o cadastro tenha mudado depois.
        const contorno = L.geoJSON(meta.geometria, {
          style: { color: "#2f4a33", weight: 2, fill: false },
        });
        removerCamada(mapa, contornoAtual);
        contornoAtual.current = contorno.addTo(mapa);
        overlay = L.imageOverlay(dados.url, bounds, { opacity: 0.75, interactive: false });
        overlay.on("load", () => {
          if (!controller.signal.aborted) setCarregando(false);
        });
        overlay.on("error", () => {
          if (!controller.signal.aborted) {
            setErro("Não foi possível baixar a imagem do mapa.");
            setCarregando(false);
            removerCamada(mapa, overlayAtual);
          }
        });
        overlayAtual.current = overlay;
        overlay.addTo(mapa);
        mapa.fitBounds(bounds, { padding: [30, 30] });
      } catch (e) {
        if (!controller.signal.aborted) {
          setErro(e.message);
          setCarregando(false);
        }
      }
    }
    carregar();
    return () => {
      controller.abort();
      if (overlay) {
        overlay.off();
        mapa.removeLayer(overlay);
        if (overlayAtual.current === overlay) overlayAtual.current = null;
      }
    };
  }, [lavouraSelecionada, imagensLavouraId, dataSelecionada, indiceSelecionado, indiceVisualizacao, usuarioId]);

  function alterarIndice(data, indice) {
    setIndicesSelecionados(anterior => ({ ...anterior, [data]: indice }));
  }

  function selecionarData(data) {
    setDataSelecionada(data);
  }

  function formatarData(data) {

    if (!data) {
      return "";
    }


    const [ano, mes, dia] =
      data.substring(0, 10).split("-");


    return `${dia}/${mes}/${ano}`;
  }


  // =========================================================
  // RENDER
  // =========================================================

  return (

    <div className="mapas-container">


      {/* =====================================================
          SELETOR DE LAVOURA
      ====================================================== */}

      {lavouras.length > 1 && (

        <div className="mapas-lavoura">

          <label>
            Lavoura
          </label>

          <select
            value={lavouraSelecionada?.id || ""}
            onChange={(e) => {

              const lavoura =
                lavouras.find(
                  (item) =>
                    item.id === Number(e.target.value)
                );

              setLavouraSelecionada(lavoura);

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

        </div>

      )}


      {/* =====================================================
          ÁREA DO HISTÓRICO
      ====================================================== */}

      <div className="mapas-area">


        {/* ===================================================
            COLUNA DE DATAS
        ==================================================== */}

        <aside className="mapas-datas">

          <div className="mapa-data-titulo">
            Imagens disponíveis
          </div>


          {imagens.length === 0 && (

            <div className="mapas-sem-imagens">
              Nenhuma imagem disponível.
            </div>

          )}


          {imagens.map((imagem) => {

            const data =
              imagem.data;

            const indiceSelecionado =
              indicesSelecionados[data];


            return (

              <div
                key={data}
                className={
                  data === dataSelecionada
                    ? "mapa-data ativa"
                    : "mapa-data"
                }
              >

                <button
                  className="mapa-data-botao"
                  onClick={() =>
                    selecionarData(data)
                  }
                >

                  <span className="mapa-data-texto">
                    {formatarData(data)}
                  </span>

                </button>


                <select
                  value={
                    indiceSelecionado || ""
                  }

                  onChange={(e) =>
                    alterarIndice(
                      data,
                      e.target.value
                    )
                  }

                  onClick={(e) =>
                    e.stopPropagation()
                  }
                >

                 {imagem.indicesDisponiveis
                  .filter((indice) => !indice.startsWith("z-score-"))
                  .map((indice) => (
                    <option key={indice} value={indice}>
                      {indice}
                    </option>
                  ))}

                </select>

              </div>

            );

          })}

        </aside>


        {/* ===================================================
            MAPA
        ==================================================== */}

        <div className="mapas-mapa-container">


          {/* =================================================
              SELETOR ÍNDICE / Z-SCORE
          ================================================== */}

          <div className="mapas-controle">

            <button
              className={
                indiceVisualizacao === "indice"
                  ? "ativo"
                  : ""
              }

              onClick={() =>
                setIndiceVisualizacao("indice")
              }
            >
              Índice
            </button>


            <button
              className={
                indiceVisualizacao === "zscore"
                  ? "ativo"
                  : ""
              }

              onClick={() =>
                setIndiceVisualizacao("zscore")
              }
            >
              Z-score
            </button>

          </div>


          {/* =================================================
              ESTADO DE CARREGAMENTO
          ================================================== */}

          {carregando && (

            <div className="mapas-carregando">
              Carregando mapa...
            </div>

          )}


          {/* =================================================
              ERRO
          ================================================== */}

          {erro && (

            <div className="mapas-erro">
              {erro}
            </div>

          )}


          <div
            ref={mapaRef}
            className="mapas-mapa"
          />

        </div>

      </div>

    </div>

  );
}