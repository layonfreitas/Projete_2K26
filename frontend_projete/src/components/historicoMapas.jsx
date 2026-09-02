import { useEffect, useRef, useState } from "react";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { AUTH_API_URL } from "../config/api";


export default function Mapas() {

  const mapaRef = useRef(null);
  const map = useRef(null);
  const overlayAtual = useRef(null);
  const contornoAtual = useRef(null);


  const [lavouras, setLavouras] = useState([]);

  const [lavouraSelecionada, setLavouraSelecionada] =
    useState(null);

  const [imagens, setImagens] = useState([]);

  const [dataSelecionada, setDataSelecionada] =
    useState(null);

  const [indicesSelecionados, setIndicesSelecionados] =
    useState({});

  const [indiceVisualizacao, setIndiceVisualizacao] =
    useState("indice");

  const [carregando, setCarregando] =
    useState(false);

  const [erro, setErro] =
    useState(null);


  // =========================================================
  // USUÁRIO
  // =========================================================

  function obterUsuarioId() {

    const usuarioTipo =
      localStorage.getItem("usuarioTipo");

    const usuarioId =
      localStorage.getItem("usuarioId");

    const produtorSelecionadoId =
      localStorage.getItem("produtorSelecionadoId");


    return usuarioTipo === "agronomo"
      ? produtorSelecionadoId
      : usuarioId;
  }


  // =========================================================
  // BUSCAR LAVOURAS
  // =========================================================

  useEffect(() => {

    async function carregarLavouras() {

      const usuarioId = obterUsuarioId();

      if (!usuarioId) {
        setErro("Usuário não identificado.");
        return;
      }

      try {

        const resposta = await fetch(
          `${AUTH_API_URL}/lavouras/${usuarioId}`
        );

        const dados = await resposta.json();

        if (!resposta.ok) {
          throw new Error(
            dados.mensagem ||
            "Erro ao buscar lavouras."
          );
        }

        setLavouras(dados);

        if (dados.length > 0) {
          setLavouraSelecionada(dados[0]);
        }

      } catch (erro) {

        console.error(
          "Erro ao carregar lavouras:",
          erro
        );

        setErro(
          "Não foi possível carregar as lavouras."
        );
      }
    }


    carregarLavouras();

  }, []);


  // =========================================================
  // BUSCAR IMAGENS DA LAVOURA
  // =========================================================

  useEffect(() => {

    if (!lavouraSelecionada) {
      return;
    }


    async function carregarImagens() {

      const usuarioId = obterUsuarioId();

      try {

        const resposta = await fetch(
          `${AUTH_API_URL}/imagens/${lavouraSelecionada.id}` +
          `?usuario_id=${usuarioId}`
        );

        const dados = await resposta.json();

        if (!resposta.ok) {
          throw new Error(
            dados.mensagem ||
            "Erro ao buscar imagens."
          );
        }


        setImagens(dados);


        // Seleciona automaticamente o primeiro índice
        // disponível de cada data.

        const selecoes = {};

        dados.forEach((imagem) => {
          const indices = imagem.indicesDisponiveis.filter(
            (indice) => !indice.startsWith("z-score-")
          );

          if (indices.length > 0) {
            selecoes[imagem.data] = indices[0];
          }
        });


        setIndicesSelecionados(selecoes);


        // Seleciona a primeira data

        if (dados.length > 0) {
          setDataSelecionada(dados[0].data);
        } else {
          setDataSelecionada(null);
        }

      } catch (erro) {

        console.error(
          "Erro ao carregar imagens:",
          erro
        );

        setErro(
          "Não foi possível carregar o histórico."
        );
      }

    }


    carregarImagens();

  }, [lavouraSelecionada]);


  // =========================================================
  // INICIALIZAÇÃO DO LEAFLET
  // =========================================================

  useEffect(() => {

    if (map.current || !mapaRef.current) {
      return;
    }


    map.current = L.map(
      mapaRef.current,
      {
        center: [-14.2350, -51.9253],
        zoom: 4,

        minZoom: 4,

        maxBounds: L.latLngBounds(
          [-35.0, -75.0],
          [6.0, -32.0]
        ),

        maxBoundsViscosity: 1.0,
      }
    );


    // =====================================================
    // MAPA BASE ARCGIS
    // =====================================================

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Tiles © Esri",
      }
    ).addTo(map.current);


    return () => {

      if (map.current) {

        map.current.remove();

        map.current = null;

      }

    };

  }, []);


  // =========================================================
  // MUDAR ÍNDICE DE UMA DATA
  // =========================================================

  function alterarIndice(data, indice) {

    setIndicesSelecionados((anterior) => ({
      ...anterior,
      [data]: indice,
    }));


    // Se essa for a data atualmente selecionada,
    // atualiza imediatamente o mapa.

    if (data === dataSelecionada) {
      carregarMapa(data, indice);
    }
  }


  // =========================================================
  // SELECIONAR DATA
  // =========================================================

  function selecionarData(data) {

    setDataSelecionada(data);

    const indice =
      indicesSelecionados[data];


    if (indice) {
      carregarMapa(data, indice);
    }
  }


  // =========================================================
  // OBTER NOME DO ÍNDICE
  // =========================================================

  function obterIndiceBanco() {

    if (!dataSelecionada) {
      return null;
    }


    const indice =
      indicesSelecionados[dataSelecionada];


    if (!indice) {
      return null;
    }


    if (indiceVisualizacao === "indice") {
      return indice;
    }


    return `z-score-${indice}`;
  }


  // =========================================================
  // CARREGAR MAPA
  // =========================================================

  async function carregarMapa(
    data,
    indice
  ) {

    if (!lavouraSelecionada || !map.current) {
      return;
    }


    const usuarioId =
      obterUsuarioId();


    const indiceBanco =
      indiceVisualizacao === "indice"
        ? indice
        : `z-score-${indice}`;


    setCarregando(true);
    setErro(null);


    try {

      const parametros = new URLSearchParams({

        id: lavouraSelecionada.id,

        usuario_id: usuarioId,

        data: data,

        indice: indiceBanco,

      });


      const resposta = await fetch(
        `${AUTH_API_URL}/acessar_imagem?${parametros}`
      );


      const dados = await resposta.json();


      if (!resposta.ok) {

        throw new Error(
          dados.mensagem ||
          "Imagem não encontrada."
        );

      }


      mostrarImagem(
        dados.url,
        dados.coordenadas
      );


    } catch (erro) {

      console.error(
        "Erro ao carregar mapa:",
        erro
      );

      setErro(
        "Não foi possível carregar o mapa."
      );

    } finally {

      setCarregando(false);

    }

  }


  // =========================================================
  // QUANDO MUDAR ENTRE ÍNDICE E Z-SCORE
  // =========================================================

  useEffect(() => {

    if (
      !dataSelecionada ||
      !indicesSelecionados[dataSelecionada]
    ) {
      return;
    }


    carregarMapa(
      dataSelecionada,
      indicesSelecionados[dataSelecionada]
    );

  }, [indiceVisualizacao]);


  // =========================================================
  // MOSTRAR IMAGEM
  // =========================================================

  function mostrarImagem(
    url,
    coordenadas
  ) {

    if (!map.current) {
      return;
    }


    // Remove overlay anterior

    if (overlayAtual.current) {

      map.current.removeLayer(
        overlayAtual.current
      );

      overlayAtual.current = null;

    }


    // Remove contorno anterior

    if (contornoAtual.current) {

      map.current.removeLayer(
        contornoAtual.current
      );

      contornoAtual.current = null;

    }


    // =====================================================
    // COORDENADAS DA LAVOURA
    // =====================================================

    let pontos;


    try {

      pontos =
        typeof coordenadas === "string"
          ? JSON.parse(coordenadas)
          : coordenadas;

    } catch (erro) {

      console.error(
        "Erro ao interpretar coordenadas:",
        erro
      );

      return;
    }


    if (
      !pontos ||
      pontos.length < 3
    ) {
      return;
    }


    const latLngs = pontos.map(
      (ponto) => [
        Number(ponto.lat),
        Number(ponto.lng),
      ]
    );


    // =====================================================
    // LIMITES DA LAVOURA
    // =====================================================

    const bounds =
      L.latLngBounds(latLngs);


    // =====================================================
    // OVERLAY DO ÍNDICE
    // =====================================================

    overlayAtual.current =
      L.imageOverlay(
        url,
        bounds,
        {
          opacity: 0.75,
          interactive: false,
        }
      ).addTo(map.current);


    // =====================================================
    // CONTORNO DA LAVOURA
    // =====================================================

    contornoAtual.current =
      L.polygon(
        latLngs,
        {
          color: "#2f4a33",
          weight: 2,
          fill: false,
        }
      ).addTo(map.current);


    // =====================================================
    // ENQUADRAR LAVOURA
    // =====================================================

    map.current.fitBounds(
      bounds,
      {
        padding: [30, 30],
      }
    );

  }


  // =========================================================
  // FORMATAR DATA
  // =========================================================

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

          <div className="mapas-datas-titulo">
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

                  {imagem.indicesDisponiveis.map(
                    (indice) => (

                      <option
                        key={indice}
                        value={indice}
                      >
                        {indice}
                      </option>

                    )
                  )}

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