import { useState, useEffect } from "react";
import { AUTH_API_URL } from "../config/api";
import { fetchAutenticado } from "../services/apiAutenticado";

import { MapContainer, TileLayer, Marker, Polygon } from "react-leaflet";

import { useParams, useNavigate } from "react-router-dom";

import "leaflet/dist/leaflet.css";
import "../utils/leafletIcons";
import "./edicao.css";

import AppBar from "../components/ui/AppBar";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import Sheet from "../components/ui/Sheet";
import { TextField } from "../components/ui/Field";
import { ErrorState, Skeleton } from "../components/ui/States";
import { useToast } from "../components/ui/toastContext";
import { calcularAreaHectares, formatarHectares } from "../utils/geo";
import { mensagemDeErro } from "../services/erros";

// ======================================================
// MARCADOR EDITÁVEL
// ======================================================

function PontoEditavel({ ponto, index, atualizarPonto }) {
  return (
    <Marker
      position={[ponto.lat, ponto.lng]}
      draggable={true}
      eventHandlers={{
        dragend: (evento) => {
          const novaPosicao = evento.target.getLatLng();

          atualizarPonto(index, {
            lat: novaPosicao.lat,
            lng: novaPosicao.lng,
          });
        },
      }}
    />
  );
}

// ======================================================
// PÁGINA DE EDIÇÃO
// ======================================================

function Edicao() {
  const navigate = useNavigate();
  const toast = useToast();

  // ID vindo da URL
  // Exemplo: /edicao/5
  const { id } = useParams();

  const [coordenadas, setCoordenadas] = useState([]);
  const [coordenadasSalvas, setCoordenadasSalvas] = useState([]);
  const [modoEdicao, setModoEdicao] = useState(false);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [tentativa, setTentativa] = useState(0);

  const [nomeLavoura, setNomeLavoura] = useState("");
  const [nomeSalvo, setNomeSalvo] = useState("");
  const [erroNome, setErroNome] = useState("");

  const [salvandoNome, setSalvandoNome] = useState(false);
  const [salvandoPontos, setSalvandoPontos] = useState(false);
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [erroRemocao, setErroRemocao] = useState("");

  // ==================================================
  // BUSCAR LAVOURA NO BACKEND
  // ==================================================

  useEffect(() => {
    if (!id) return undefined;

    let cancelado = false;

    async function carregarLavoura() {
      try {
        const resposta = await fetchAutenticado(`${AUTH_API_URL}/lavoura/${id}`);

        const dados = await resposta.json();

        if (!resposta.ok) {
          throw new Error(dados.mensagem || "Erro ao buscar lavoura.");
        }

        if (cancelado) return;

        // Guarda as coordenadas e o nome
        setCoordenadas(dados.coordenadas || []);
        setCoordenadasSalvas(dados.coordenadas || []);
        setNomeLavoura(dados.nomeLavoura || "");
        setNomeSalvo(dados.nomeLavoura || "");
        setErro("");

        // Guarda também no localStorage
        localStorage.setItem("lavouraNome", dados.nomeLavoura || "");
      } catch (erro) {
        if (cancelado) return;
        console.error("Erro ao carregar lavoura:", erro);
        setErro(mensagemDeErro(erro, "Erro ao carregar lavoura."));
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    carregarLavoura();

    return () => {
      cancelado = true;
    };
  }, [id, tentativa]);

  function tentarDeNovo() {
    setCarregando(true);
    setErro("");
    setTentativa((n) => n + 1);
  }

  // ==================================================
  // ATUALIZAR UM PONTO
  // ==================================================

  function atualizarPonto(index, novoPonto) {
    setCoordenadas((anteriores) =>
      anteriores.map((ponto, i) => (i === index ? novoPonto : ponto))
    );
  }

  const pontosAlterados = JSON.stringify(coordenadas) !== JSON.stringify(coordenadasSalvas);
  const nomeAlterado = nomeLavoura.trim() !== nomeSalvo.trim();

  // ==================================================
  // SALVAR PONTOS
  // ==================================================

  async function salvarPontos() {
    setSalvandoPontos(true);

    try {
      const resposta = await fetchAutenticado(`${AUTH_API_URL}/lavoura/${id}`, {
        method: "PUT",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          coordenadas: coordenadas,
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(dados.mensagem || "Erro ao salvar coordenadas.");
      }

      toast.sucesso("Área da lavoura atualizada!");

      setCoordenadasSalvas(coordenadas);
      setModoEdicao(false);
    } catch (erro) {
      console.error("Erro ao salvar coordenadas:", erro);
      toast.erro(mensagemDeErro(erro, "Erro ao salvar coordenadas."));
    } finally {
      setSalvandoPontos(false);
    }
  }

  // ==================================================
  // SALVAR NOME
  // ==================================================

  async function salvarNome(evento) {
    evento.preventDefault();

    if (!nomeLavoura.trim()) {
      setErroNome("Digite um nome para a lavoura.");
      return;
    }

    setErroNome("");
    setSalvandoNome(true);

    try {
      const resposta = await fetchAutenticado(`${AUTH_API_URL}/lavoura/${id}`, {
        method: "PUT",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          nomeLavoura: nomeLavoura.trim(),
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(dados.mensagem || "Erro ao salvar nome.");
      }

      localStorage.setItem("lavouraNome", nomeLavoura.trim());
      setNomeSalvo(nomeLavoura.trim());

      toast.sucesso("Nome da lavoura atualizado!");
    } catch (erro) {
      console.error("Erro ao salvar nome:", erro);
      toast.erro(mensagemDeErro(erro, "Erro ao salvar nome."));
    } finally {
      setSalvandoNome(false);
    }
  }

  // ==================================================
  // REMOVER LAVOURA
  // ==================================================

  async function removerLavoura() {
    setRemovendo(true);
    setErroRemocao("");

    try {
      const resposta = await fetchAutenticado(`${AUTH_API_URL}/lavoura/${id}`, {
        method: "DELETE",
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(dados.mensagem || "Erro ao remover lavoura.");
      }

      localStorage.removeItem("lavouraId");

      localStorage.removeItem("lavouraNome");

      toast.sucesso("Lavoura removida com sucesso!");

      navigate("/home");
    } catch (erro) {
      console.error("Erro ao remover lavoura:", erro);
      setErroRemocao(mensagemDeErro(erro, "Erro ao remover lavoura."));
    } finally {
      setRemovendo(false);
    }
  }

  // ==================================================
  // CARREGANDO / ERRO
  // ==================================================

  if (carregando) {
    return (
      <div className="ui-coluna ui-coluna--sem-nav">
        <AppBar titulo="Editar lavoura" para="/home" />
        <div className="ui-conteudo" aria-busy="true">
          <Skeleton linhas={2} altura={150} />
        </div>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="ui-coluna ui-coluna--sem-nav">
        <AppBar titulo="Editar lavoura" para="/home" />
        <div className="ui-conteudo">
          <ErrorState mensagem={erro} aoTentar={tentarDeNovo} />
        </div>
      </div>
    );
  }

  const posicoes = coordenadas.map((ponto) => [ponto.lat, ponto.lng]);
  const area = calcularAreaHectares(coordenadas);

  // ==================================================
  // PÁGINA
  // ==================================================

  return (
    <div className="ui-coluna ui-coluna--sem-nav">
      <AppBar
        titulo="Editar lavoura"
        subtitulo={nomeSalvo || "Altere as informações da sua lavoura."}
        para="/home"
      />

      <div className="ui-conteudo">
        {/* ======================================
            ALTERAR NOME
        ====================================== */}

        <form className="ui-cartao ui-formulario" onSubmit={salvarNome} noValidate>
          <div>
            <h2 className="edi-titulo">Nome da lavoura</h2>
            <p className="edi-texto">Altere o nome utilizado para identificar esta lavoura.</p>
          </div>

          <TextField
            label="Nome"
            className="edi-nome"
            autoComplete="off"
            error={erroNome}
            value={nomeLavoura}
            onChange={(evento) => {
              setNomeLavoura(evento.target.value);
              if (erroNome) setErroNome("");
            }}
          />

          <Button type="submit" block loading={salvandoNome} disabled={!nomeAlterado}>
            Salvar nome
          </Button>
        </form>

        {/* ======================================
            EDITAR ÁREA
        ====================================== */}

        <section className="ui-cartao ui-formulario">
          <div className="edi-cabecalho-area">
            <div>
              <h2 className="edi-titulo">Área da lavoura</h2>
              <p className="edi-texto">Ajuste os pontos do mapa para corrigir os limites.</p>
            </div>
            <span className="edi-area">
              <Icon nome="area" tamanho={16} />
              {formatarHectares(area)}
            </span>
          </div>

          <div className="mapa-edicao-container">
            {coordenadas.length > 0 && (
              <MapContainer
                bounds={posicoes}
                boundsOptions={{ padding: [30, 30] }}
                style={{
                  width: "100%",
                  height: "100%",
                }}
              >
                <TileLayer
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  attribution="Tiles © Esri"
                />

                <Polygon
                  positions={posicoes}
                  pathOptions={{ color: "#2f4a33", weight: 3, fillOpacity: 0.2 }}
                />

                {modoEdicao &&
                  coordenadas.map((ponto, index) => (
                    <PontoEditavel
                      key={index}
                      ponto={ponto}
                      index={index}
                      atualizarPonto={atualizarPonto}
                    />
                  ))}
              </MapContainer>
            )}
          </div>

          <p className={`edi-ajuda ${modoEdicao ? "edi-ajuda-ativa" : ""}`} aria-live="polite">
            <Icon nome="info" tamanho={16} />
            {modoEdicao
              ? "Arraste os pontos para ajustar a área."
              : "Toque em “Editar pontos” para alterar a área."}
          </p>

          <div className="edi-botoes">
            <Button
              variant={modoEdicao ? "gold" : "secondary"}
              icon={modoEdicao ? "check" : "lapis"}
              onClick={() => setModoEdicao(!modoEdicao)}
            >
              {modoEdicao ? "Parar de editar" : "Editar pontos"}
            </Button>

            <Button
              onClick={salvarPontos}
              loading={salvandoPontos}
              disabled={!pontosAlterados}
            >
              Salvar pontos
            </Button>
          </div>
        </section>

        {/* ======================================
            REMOVER
        ====================================== */}

        <section className="ui-cartao edi-perigo">
          <div>
            <h2 className="edi-titulo">Remover lavoura</h2>
            <p className="edi-texto">
              A remoção da lavoura é permanente e não poderá ser desfeita.
            </p>
          </div>

          <Button
            variant="danger-soft"
            icon="lixeira"
            block
            onClick={() => {
              setErroRemocao("");
              setConfirmandoRemocao(true);
            }}
          >
            Remover lavoura
          </Button>
        </section>
      </div>

      <Sheet
        aberto={confirmandoRemocao}
        aoFechar={() => setConfirmandoRemocao(false)}
        titulo={`Remover ${nomeSalvo || "esta lavoura"}?`}
        descricao="Essa ação é permanente e não pode ser desfeita."
      >
        {erroRemocao && (
          <p className="edi-erro-remocao" role="alert">
            {erroRemocao}
          </p>
        )}

        <div className="ui-painel-botoes">
          <Button
            variant="secondary"
            data-foco
            onClick={() => setConfirmandoRemocao(false)}
            disabled={removendo}
          >
            Cancelar
          </Button>
          <Button variant="danger" icon="lixeira" onClick={removerLavoura} loading={removendo}>
            {removendo ? "Removendo…" : "Remover lavoura"}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

export default Edicao;