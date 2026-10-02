import { useState, useEffect } from "react";
import { AUTH_API_URL } from "../config/api";
import { fetchAutenticado } from "../services/apiAutenticado";

import { MapContainer, TileLayer, Marker, Polygon, useMapEvents } from "react-leaflet";

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

function dataLocalTexto(data = new Date()) {
  return [
    data.getFullYear(),
    String(data.getMonth() + 1).padStart(2, "0"),
    String(data.getDate()).padStart(2, "0"),
  ].join("-");
}

function dataBR(texto) {
  if (!texto) return "—";
  const [ano, mes, dia] = texto.split("-");
  return `${dia}/${mes}/${ano}`;
}

function diaSeguinte(texto) {
  if (!texto) return "2017-03-28";
  const [ano, mes, dia] = texto.split("-").map(Number);
  const data = new Date(ano, mes - 1, dia);
  data.setDate(data.getDate() + 1);
  return dataLocalTexto(data);
}

// ======================================================
// MARCADOR EDITÁVEL
// ======================================================
function MapaAdicionarPonto({ ativo, adicionarPonto }) {
  useMapEvents({
    click: (evento) => {
      if (!ativo) return;

      adicionarPonto({
        lat: evento.latlng.lat,
        lng: evento.latlng.lng,
      });
    },
  });

  return null;
}

function PontoEditavel({ ponto, index, atualizarPonto, removerPonto }) {
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
        click: () => {
          removerPonto(index);
        }
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

  const [safras, setSafras] = useState([]);
  const [confirmandoEncerramento, setConfirmandoEncerramento] = useState(false);
  const [dataEncerramento, setDataEncerramento] = useState(dataLocalTexto());
  const [inicioNovaSafra, setInicioNovaSafra] = useState("");
  const [processandoSafra, setProcessandoSafra] = useState(false);
  const [erroSafra, setErroSafra] = useState("");

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
        setSafras(Array.isArray(dados.safras) ? dados.safras : []);
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
  function adicionarPonto(novoPonto) {
  setCoordenadas((anteriores) => [
    ...anteriores,
    novoPonto,
  ]);
}
function removerPonto(index) {
  setCoordenadas((anteriores) => {
    if (anteriores.length <= 3) {
      toast.erro("A lavoura precisa ter pelo menos 3 pontos.");
      return anteriores;
    }

    return anteriores.filter((_, i) => i !== index);
  });
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
            if (dados.mapas) {
        if (dados.mapas.status === "aceito") {
          toast.sucesso(dados.mapas.mensagem);
        } else {
          toast.erro(`Lavoura salva. ${dados.mapas.mensagem}`);
        }

      }

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
  // SAFRAS
  // ==================================================

  async function encerrarSafraAtual() {
    if (!dataEncerramento) {
      setErroSafra("Informe a data em que a safra terminou.");
      return;
    }

    setProcessandoSafra(true);
    setErroSafra("");

    try {
      const resposta = await fetchAutenticado(
        `${AUTH_API_URL}/lavoura/${id}/safra/encerrar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fim: dataEncerramento }),
        }
      );
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.mensagem || "Erro ao encerrar safra.");

      setSafras(Array.isArray(dados.safras) ? dados.safras : []);
      setConfirmandoEncerramento(false);
      setInicioNovaSafra("");
      toast.sucesso("Safra encerrada. Agora você pode iniciar a próxima safra.");
    } catch (erro) {
      setErroSafra(mensagemDeErro(erro, "Erro ao encerrar safra."));
    } finally {
      setProcessandoSafra(false);
    }
  }

  async function iniciarNovaSafra(evento) {
    evento.preventDefault();

    if (!inicioNovaSafra) {
      setErroSafra("Informe a data de início da nova safra.");
      return;
    }

    setProcessandoSafra(true);
    setErroSafra("");

    try {
      const resposta = await fetchAutenticado(
        `${AUTH_API_URL}/lavoura/${id}/safra/iniciar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inicio: inicioNovaSafra }),
        }
      );
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.mensagem || "Erro ao iniciar nova safra.");

      setSafras(Array.isArray(dados.safras) ? dados.safras : []);
      setInicioNovaSafra("");
      toast.sucesso("Nova safra iniciada com sucesso!");

      if (dados.mapas?.mensagem) {
        if (dados.mapas.status === "aceito" || dados.mapas.status === "na_fila") {
          toast.sucesso(dados.mapas.mensagem);
        } else {
          toast.erro(`Safra salva. ${dados.mapas.mensagem}`);
        }
      }
    } catch (erro) {
      setErroSafra(mensagemDeErro(erro, "Erro ao iniciar nova safra."));
    } finally {
      setProcessandoSafra(false);
    }
  }

  const safraAtual = safras.find((safra) => safra.atual);
  const safrasEncerradas = safras.filter((safra) => !safra.atual);
  const ultimaSafraEncerrada = [...safrasEncerradas].sort((a, b) =>
    String(b.fim).localeCompare(String(a.fim))
  )[0];

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
      <div className="ui-coluna ui-coluna--cheia ui-coluna--sem-nav">
        <AppBar titulo="Editar lavoura" para="/home" />
        <div className="ui-conteudo" aria-busy="true">
          <Skeleton linhas={2} altura={150} />
        </div>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="ui-coluna ui-coluna--cheia ui-coluna--sem-nav">
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
    <div className="ui-coluna ui-coluna--cheia ui-coluna--sem-nav">
      <AppBar
        titulo="Editar lavoura"
        subtitulo={nomeSalvo || "Altere as informações da sua lavoura."}
        para="/home"
      />

      <div className="ui-conteudo edi-grid">
        {/* ======================================
            ALTERAR NOME
        ====================================== */}

        <form className="ui-cartao ui-formulario edi-nome-cartao" onSubmit={salvarNome} noValidate>
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
            SAFRA ATUAL
        ====================================== */}

        <section className="ui-cartao ui-formulario edi-safra-cartao">
          <div>
            <h2 className="edi-titulo">Safra da lavoura</h2>
            <p className="edi-texto">
              Encerre a safra quando o ciclo terminar. Depois disso, você poderá iniciar uma nova sem perder o histórico.
            </p>
          </div>

          {safraAtual ? (
            <div className="edi-safra-atual">
              <div className="edi-safra-status">
                <span className="edi-safra-badge">Safra atual</span>
                <strong>{safraAtual.ano}</strong>
              </div>
              <div className="edi-safra-datas">
                <span><small>Início</small><strong>{dataBR(safraAtual.inicio)}</strong></span>
                <span><small>Status</small><strong>Em andamento</strong></span>
              </div>
              <Button
                variant="secondary"
                block
                onClick={() => {
                  setErroSafra("");
                  setDataEncerramento(dataLocalTexto());
                  setConfirmandoEncerramento(true);
                }}
              >
                Encerrar safra atual
              </Button>
            </div>
          ) : (
            <form className="edi-nova-safra" onSubmit={iniciarNovaSafra}>
              <div className="edi-sem-safra">
                <strong>Nenhuma safra em andamento</strong>
                <span>
                  {ultimaSafraEncerrada
                    ? `A última safra terminou em ${dataBR(ultimaSafraEncerrada.fim)}.`
                    : "Cadastre a data de início para começar o acompanhamento."}
                </span>
              </div>

              <TextField
                label="Início da nova safra"
                type="date"
                min={diaSeguinte(ultimaSafraEncerrada?.fim)}
                max={dataLocalTexto()}
                value={inicioNovaSafra}
                error={erroSafra}
                onChange={(evento) => {
                  setInicioNovaSafra(evento.target.value);
                  if (erroSafra) setErroSafra("");
                }}
              />

              <Button type="submit" block loading={processandoSafra}>
                Iniciar nova safra
              </Button>
            </form>
          )}

          {safraAtual && erroSafra && (
            <p className="edi-erro-remocao" role="alert">{erroSafra}</p>
          )}
        </section>

        {/* ======================================
            EDITAR ÁREA
        ====================================== */}

        <section className="ui-cartao ui-formulario edi-area-cartao">
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
                      removerPonto={removerPonto}
                    />
                  ))}
                  <MapaAdicionarPonto
  ativo={modoEdicao}
  adicionarPonto={adicionarPonto}
/>
              </MapContainer>
            )}
          </div>
          

          <p className={`edi-ajuda ${modoEdicao ? "edi-ajuda-ativa" : ""}`} aria-live="polite">
            <Icon nome="info" tamanho={16} />
            {modoEdicao
              ? "Arraste os pontos, toque em um ponto para removê-lo ou toque no mapa para adicionar novos pontos."
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

        <section className="ui-cartao edi-perigo edi-perigo-cartao">
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
        aberto={confirmandoEncerramento}
        aoFechar={() => !processandoSafra && setConfirmandoEncerramento(false)}
        titulo="Encerrar safra atual?"
        descricao="A safra continuará no histórico. Depois do encerramento, você poderá iniciar uma nova safra."
      >
        <TextField
          label="Data de encerramento"
          type="date"
          min={safraAtual?.inicio || "2017-03-28"}
          max={dataLocalTexto()}
          value={dataEncerramento}
          error={erroSafra}
          onChange={(evento) => {
            setDataEncerramento(evento.target.value);
            if (erroSafra) setErroSafra("");
          }}
        />

        <div className="ui-painel-botoes">
          <Button
            variant="secondary"
            data-foco
            onClick={() => setConfirmandoEncerramento(false)}
            disabled={processandoSafra}
          >
            Cancelar
          </Button>
          <Button onClick={encerrarSafraAtual} loading={processandoSafra}>
            Encerrar safra
          </Button>
        </div>
      </Sheet>

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