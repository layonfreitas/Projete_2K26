import { useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css"
import "./historico.css";

import { AUTH_API_URL } from "../config/api";
import { buscarJson, validarMapa } from "../services/historicoAPI";
import { fetchAutenticado } from "../services/apiAutenticado";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import HistoricoMapas from "../components/historicoMapas.jsx";
import BottomNav from "../components/BottomNav";
import Header from "../components/Header";

const ABAS = [
  {
    id: "mapas",
    nome: "Mapas",
    componente: HistoricoMapas,
  },
  {
    id: "alerta",
    nome: "Alertas",
    componente: HistoricoAlerta,
  },
];

const estilo = { color: '#2f4a33', weight: 2, fill: false };

// Texto de cada alerta, por índice e por nível (crítico / atenção).
const INFO_INDICES = {
  NDVI: {
    nome: "Vigor da vegetação",
    sigla: "NDVI",
    explica:
      "O NDVI mede o vigor e a quantidade de folhagem verde. As áreas coloridas " +
      "no mapa estão fora do padrão esperado para esta lavoura nesta fase da safra.",
    resumo: {
      critico: "Vigor da vegetação muito fora do padrão em parte da lavoura.",
      atencao: "Vigor da vegetação com variação acima do normal em parte da lavoura.",
    },
    acao: {
      critico:
        "Vá o quanto antes às áreas destacadas no mapa. Confira falhas no plantio, pragas, " +
        "doenças e danos recentes (geada, granizo, seca) e, se possível, acione o agrônomo.",
      atencao:
        "Acompanhe as áreas destacadas nas próximas imagens. Se a mancha persistir ou crescer, " +
        "faça uma visita de campo.",
    },
  },
  NDRE: {
    nome: "Clorofila e nutrição",
    sigla: "NDRE",
    explica:
      "O NDRE é sensível à clorofila e ao estado nutricional das folhas. As áreas coloridas " +
      "no mapa destoam do padrão esperado para esta lavoura nesta fase da safra.",
    resumo: {
      critico: "Resposta das folhas muito fora do padrão em parte da lavoura.",
      atencao: "Resposta das folhas com variação acima do normal em parte da lavoura.",
    },
    acao: {
      critico:
        "Observe nas áreas destacadas folhas amareladas, sinais de deficiência nutricional ou " +
        "doenças. Converse com o agrônomo sobre uma análise foliar.",
      atencao:
        "Registre as condições das folhas nas áreas destacadas e compare com as próximas imagens.",
    },
  },
  NDWI: {
    nome: "Água na vegetação",
    sigla: "NDWI",
    explica:
      "O NDWI indica o teor de água na vegetação. As áreas coloridas no mapa destoam do padrão " +
      "esperado para esta lavoura nesta fase da safra.",
    resumo: {
      critico: "Água na vegetação muito fora do padrão em parte da lavoura.",
      atencao: "Água na vegetação com variação acima do normal em parte da lavoura.",
    },
    acao: {
      critico:
        "Verifique umidade do solo, irrigação e sinais de estresse hídrico nas áreas destacadas, " +
        "como folhas murchas ou enroladas.",
      atencao:
        "Acompanhe a umidade do solo nas áreas destacadas e veja se a variação continua nas próximas imagens.",
    },
  },
  CLMI: {
    nome: "Classificação automática",
    sigla: "CLMI",
    explica:
      "Este alerta vem de uma classificação automática que combina o índice CLMI da imagem com a " +
      "temperatura média e a chuva acumulada dos últimos 30 dias na região. " +
      "Ele vale para a lavoura inteira e por isso não tem mapa.",
    resumo: {
      critico: "Classificação automática de risco alta para a lavoura inteira.",
      atencao: "Classificação automática pede acompanhamento da lavoura inteira.",
    },
    acao: {
      critico:
        "Peça ao agrônomo uma avaliação em campo e compare com o que você tem observado " +
        "nas plantas nos últimos dias.",
      atencao:
        "Acompanhe a lavoura nos próximos dias e registre qualquer mudança observada.",
    },
  },
};

const INFO_PADRAO = {
  nome: "Alteração registrada",
  sigla: "",
  explica: "Foi registrada uma alteração que precisa ser avaliada.",
  resumo: {
    critico: "Foi registrada uma alteração importante que precisa ser avaliada.",
    atencao: "Foi registrada uma alteração que merece acompanhamento.",
  },
  acao: {
    critico: "Consulte o agrônomo e verifique a lavoura em campo.",
    atencao: "Acompanhe a lavoura nas próximas imagens.",
  },
};

function infoDoAlerta(indice) {
  return INFO_INDICES[indice] || INFO_PADRAO;
}

function nivelDoAlerta(critico) {
  return critico ? "critico" : "atencao";
}

function formatarDataBR(texto) {
  const partes = String(texto || "").split("-");
  return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : "";
}

function HistoricoAlerta() {
  const location = useLocation();
  const idDoLink = new URLSearchParams(location.search).get("lavouraId");
  const alvo = /^[1-9]\d*$/.test(idDoLink || "") ? idDoLink : null;
  const usuarioAutenticado = localStorage.getItem("usuarioId");
  const tipo = localStorage.getItem("usuarioTipo");
  const container = useRef(null);
  const mapa = useRef(null);
  const camada = useRef(null);
  const contornoLayer = useRef(null);

  const usuarioId = localStorage.getItem('usuarioTipo') === 'agronomo'
    ? localStorage.getItem('produtorSelecionadoId') : localStorage.getItem('usuarioId');

  const [lavouras, setLavouras] = useState([]);
  const [lavouraId, setLavouraId] = useState('');
  const [consultaLavouras, setConsultaLavouras] = useState({ carregando: false, erro: '' });

  const [alertas, setAlertas] = useState([]);
  const [consultaAlertas, setConsultaAlertas] = useState({ carregando: false, erro: '' });

  const [alertaSelecionadoId, setAlertaSelecionadoId] = useState(null);
  const [estadoMapa, setEstadoMapa] = useState({ carregando: false, erro: '', dados: null });
  const [excluindoId, setExcluindoId] = useState(null);

  const alertaSelecionado = alertas.find(a => a.id === alertaSelecionadoId);
  const mapasDosAlertas = {
  NDVI: "z_score_NDVI_final",
  NDRE: "z_score_NDRE_final",
  NDWI: "z_score_NDWI_final",
};

const indiceMapa =
  mapasDosAlertas[alertaSelecionado?.indice];

const temMapa = Boolean(
  alertaSelecionado?.data_imagem &&
  alertaSelecionado?.contorno &&
  indiceMapa
);

  useEffect(() => {
    const map = L.map(container.current, { center: [-14.235, -51.925], zoom: 4, maxZoom: 17, scrollWheelZoom: 'center', doubleClickZoom:'center',touchZoom:'center', maxBoundsViscosity: 1, zoomAnimation: true});
    mapa.current = map;
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Tiles © Esri', maxNativeZoom: 19, maxZoom: 17 }).addTo(map);
    return () => { map.remove(); mapa.current = null; camada.current = null; contornoLayer.current = null; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLavouras([]);
    setLavouraId("");
    setAlertas([]);
    setConsultaLavouras({ carregando: true, erro: "" });

    async function carregar() {
      if (!usuarioAutenticado) throw new Error("Entre na sua conta.");
      let dados;
      if (tipo === "agronomo") {
        const [todas, produtores] = await Promise.all([
          buscarJson(`${AUTH_API_URL}/lavouras`, controller.signal),
          buscarJson(`${AUTH_API_URL}/agronomo/${usuarioAutenticado}/produtores`, controller.signal),
        ]);
        if (!Array.isArray(todas) || !Array.isArray(produtores)) {
          throw new Error("Resposta inválida ao consultar as lavouras.");
        }
        const permitidos = new Set(produtores.map(p => String(p.id)));
        dados = todas.filter(l => permitidos.has(String(l.usuarioId)));
        // Pelo e-mail, a lavoura vem da URL e independe da seleção anterior.
        if (!alvo && usuarioId) {
          dados = dados.filter(l => String(l.usuarioId) === String(usuarioId));
        }
      } else if (tipo === "produtor") {
        dados = await buscarJson(
          `${AUTH_API_URL}/lavouras/${usuarioAutenticado}`,
          controller.signal
        );
      } else {
        throw new Error("Use uma conta de produtor ou agrônomo para consultar estes alertas.");
      }

      if (!Array.isArray(dados)) throw new Error("Lista de lavouras inválida.");
      if (alvo && !dados.some(l => String(l.id) === alvo)) {
        throw new Error("A lavoura do link não está disponível para esta conta.");
      }
      if (controller.signal.aborted) return;
      setLavouras(dados);
      setLavouraId(alvo || String(dados[0]?.id || ""));
      setConsultaLavouras({ carregando: false, erro: "" });
    }

    carregar().catch(erro => {
      if (!controller.signal.aborted) {
        setConsultaLavouras({ carregando: false, erro: erro.message });
      }
    });
    return () => controller.abort();
  }, [usuarioAutenticado, usuarioId, tipo, alvo]);

  useEffect(() => {
    const controller = new AbortController();
    if (!lavouraId) { setAlertas([]); return () => controller.abort(); }
    setConsultaAlertas({ carregando: true, erro: '' });
    setAlertaSelecionadoId(null);
    buscarJson(`${AUTH_API_URL}/alertas/${lavouraId}`, controller.signal).then(dados => {
      if (controller.signal.aborted) return;
      if (!Array.isArray(dados)) throw new Error('Resposta inválida ao consultar os alertas.');
      setAlertas(dados);
      setConsultaAlertas({ carregando: false, erro: '' });
    }).catch(e => {
      if (!controller.signal.aborted) setConsultaAlertas({ carregando: false, erro: e.message });
    });
    return () => controller.abort();
  }, [lavouraId]);

  useEffect(() => {
    const controller = new AbortController();
    const map = mapa.current;
    let layer;
    if (!map) return () => controller.abort();

    if (camada.current) { map.removeLayer(camada.current); camada.current = null; }
    if (contornoLayer.current) { map.removeLayer(contornoLayer.current); contornoLayer.current = null; }

    if (!temMapa || !alertaSelecionado) {
      setEstadoMapa({ carregando: false, erro: '', dados: null });
      return () => controller.abort();
    }

    // O mapa fica escondido enquanto o alerta não tem mapa; ao aparecer,
    // o Leaflet precisa recalcular o tamanho antes de enquadrar a lavoura.
    map.invalidateSize({ animate: false });

    setEstadoMapa({ carregando: true, erro: '', dados: null });

    const params = new URLSearchParams({
  usuario_id: String(alertaSelecionado.usuario_id),
  id: String(lavouraId),
  data: alertaSelecionado.data_imagem,
  indice: indiceMapa,
  contorno: alertaSelecionado.contorno,
});

    buscarJson(`${AUTH_API_URL}/acessar_imagem?${params}`, controller.signal).then(dados => {
      if (controller.signal.aborted) return;
      const meta = validarMapa(dados, lavouraId, alertaSelecionado.usuario_id);
      const bounds = L.latLngBounds(meta.bounds);
      contornoLayer.current = L.geoJSON(meta.geometria, { style: estilo }).addTo(map);
      layer = L.imageOverlay(dados.url, bounds, { opacity: 0.8, interactive: false });
      camada.current = layer;
      layer.once('load', () => {
        if (controller.signal.aborted || camada.current !== layer) return;
        setEstadoMapa({ carregando: false, erro: '', dados });
      });
      layer.once('error', () => {
        if (controller.signal.aborted) return;
        setEstadoMapa({ carregando: false, erro: 'Não foi possível baixar a imagem do mapa.', dados: null });
      });
      layer.addTo(map);
      map.setMaxBounds(null);
      map.setMinZoom(0);
      map.fitBounds(bounds, {padding: [30,30], animate:false});
      map.setMinZoom(map.getZoom()-1);
      map.setMaxBounds(bounds.pad(0.1))
    }).catch(e => {
      if (!controller.signal.aborted) setEstadoMapa({ carregando: false, erro: e.message, dados: null });
    });

    return () => {
  controller.abort();

  if (layer) {
    if (mapa.current === map) {
      map.removeLayer(layer);
    }

    layer.off();
  }

  if (camada.current === layer) {
    camada.current = null;
  }
};

  }, [alertaSelecionadoId, temMapa]);

  async function excluirAlerta(id) {
    setExcluindoId(id);
    try {
      const resposta = await fetchAutenticado(`${AUTH_API_URL}/alertas/${id}`, { method: 'DELETE' });
      if (!resposta.ok) throw new Error('Não foi possível excluir o alerta.');
      setAlertas(anteriores => anteriores.filter(a => a.id !== id));
      if (alertaSelecionadoId === id) setAlertaSelecionadoId(null);
    } catch (e) {
      setConsultaAlertas(anterior => ({ ...anterior, erro: e.message }));
    } finally {
      setExcluindoId(null);
    }
  }

  return (
    <div className="hist-alerta">
      <div className="hist-alerta-conteudo">
        <div className="hist-alerta-barra">
          <div className="ui-field hist-alerta-lavoura">
            <label htmlFor="alerta-lavoura">Lavoura</label>
            <select
              id="alerta-lavoura"
              value={lavouraId}
              onChange={e => setLavouraId(e.target.value)}
              disabled={!lavouras.length}
            >
              {!lavouras.length && <option value="">Nenhuma lavoura cadastrada</option>}
              {lavouras.map(l => <option key={l.id} value={l.id}>{l.nomeLavoura}</option>)}
            </select>
          </div>
        </div>

        {consultaLavouras.erro && <p className="hist-alerta-erro" role="alert">{consultaLavouras.erro}</p>}

        <div className="hist-alerta-area">
          <aside className="hist-alerta-lista" aria-label="Alertas da lavoura">
            {consultaAlertas.carregando && <p className="hist-alerta-status">Carregando alertas…</p>}
            {consultaAlertas.erro && <p className="hist-alerta-erro" role="alert">{consultaAlertas.erro}</p>}
            {!consultaAlertas.carregando && !alertas.length && !consultaAlertas.erro && (
              <p className="hist-alerta-vazio">
                Nenhum alerta para esta lavoura. Isso é bom sinal: as imagens analisadas
                não apontaram nada fora do padrão.
              </p>
            )}

            <ul className="hist-alerta-itens">
              {alertas.map((alerta, posicao) => {
                const info = infoDoAlerta(alerta.indice);
                const nivel = nivelDoAlerta(alerta.critico);
                const novaData =
                  posicao === 0 || alertas[posicao - 1].data_imagem !== alerta.data_imagem;

                return (
                  <li key={alerta.id} className={novaData ? 'hist-alerta-comeco-grupo' : undefined}>
                    {novaData && (
                      <h3 className="hist-alerta-grupo">
                        {alerta.data_imagem
                          ? `Imagem de ${formatarDataBR(alerta.data_imagem)}`
                          : 'Sem data de imagem'}
                      </h3>
                    )}
                    <div className="hist-alerta-linha">
                      <button
                        type="button"
                        className={`hist-alerta-item ${alertaSelecionadoId === alerta.id ? 'ativo' : ''}`}
                        onClick={() => setAlertaSelecionadoId(alerta.id)}
                        aria-pressed={alertaSelecionadoId === alerta.id}
                      >
                        <span className={`hist-alerta-badge ${nivel}`}>
                          {alerta.critico ? 'Crítico' : 'Atenção'}
                        </span>
                        <strong>
                          {info.nome}
                          {info.sigla ? ` (${info.sigla})` : ''}
                        </strong>
                        <p>{info.resumo[nivel]}</p>
                      </button>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon="lixeira"
                        className="ui-btn--icon hist-alerta-excluir"
                        aria-label={`Excluir alerta de ${info.nome}`}
                        title="Excluir alerta"
                        disabled={excluindoId === alerta.id}
                        onClick={() => excluirAlerta(alerta.id)}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </aside>

          <div className="hist-alerta-visao">
            {/* O contêiner do mapa continua montado (o Leaflet depende dele),
                mas só aparece quando o alerta tem mapa. */}
            <div
              className="hist-alerta-mapa-caixa"
              style={{ display: temMapa ? undefined : 'none' }}
            >
              <div ref={container} className="hist-alerta-mapa" aria-label="Mapa do alerta" />
              {estadoMapa.carregando && (
                <div className="hist-alerta-status-mapa" role="status">
                  <span className="ui-spinner" aria-hidden="true" /> Carregando mapa…
                </div>
              )}
              {estadoMapa.erro && (
                <div className="hist-alerta-status-mapa hist-alerta-erro" role="alert">
                  <Icon nome="alertaCirculo" tamanho={22} />
                  <p>{estadoMapa.erro}</p>
                </div>
              )}
            </div>

            {!alertaSelecionado && (
              <div className="hist-alerta-detalhe hist-alerta-detalhe--vazio">
                <p>
                  {alertas.length
                    ? 'Selecione um alerta na lista para ver o que aconteceu e o que fazer.'
                    : 'Quando houver alertas, os detalhes aparecem aqui.'}
                </p>
              </div>
            )}

            {alertaSelecionado && (() => {
              const info = infoDoAlerta(alertaSelecionado.indice);
              const nivel = nivelDoAlerta(alertaSelecionado.critico);
              const lavoura = lavouras.find(l => String(l.id) === String(lavouraId));

              return (
                <article className={`hist-alerta-detalhe ${nivel}`} aria-live="polite">
                  <header>
                    <span className={`hist-alerta-badge ${nivel}`}>
                      {alertaSelecionado.critico ? 'Crítico' : 'Atenção'}
                    </span>
                    <h3>
                      {info.nome}
                      {info.sigla ? ` (${info.sigla})` : ''}
                    </h3>
                  </header>

                  <p className="hist-alerta-meta">
                    {lavoura ? `${lavoura.nomeLavoura} · ` : ''}
                    {alertaSelecionado.data_imagem
                      ? `imagem de satélite de ${formatarDataBR(alertaSelecionado.data_imagem)}`
                      : 'data da imagem não informada'}
                  </p>

                  <p>{info.explica}</p>

                  {!temMapa && alertaSelecionado.indice !== 'CLMI' && (
                    <p className="hist-alerta-nota">
                      O mapa deste alerta não está disponível. Tente reprocessar a lavoura
                      pelo botão Gerar imagens, na aba Mapas.
                    </p>
                  )}

                  <h4>O que fazer</h4>
                  <p>{info.acao[nivel]}</p>

                  <small>
                    Este aviso automático indica uma anomalia nos dados; não confirma doença
                    nem perda de produção.
                  </small>
                </article>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Historico() {
  const location = useLocation();
  const abaDoLink = new URLSearchParams(location.search).get("aba");
  const [abaAtiva, setAbaAtiva] = useState(
    () => ABAS.some(aba => aba.id === abaDoLink) ? abaDoLink : ABAS[0].id
  );

  useEffect(() => {
    setAbaAtiva(ABAS.some(aba => aba.id === abaDoLink) ? abaDoLink : ABAS[0].id);
  }, [abaDoLink]);

  const abaSelecionada = ABAS.find((aba) => aba.id === abaAtiva);
  const ComponenteAba = abaSelecionada.componente;

  return (
    <div className="hist">
      <Header />

      <main className="hist-conteudo">
        <div className="hist-cabecalho">
          <h1>Histórico</h1>
          <p>Consulte os dados e mapas históricos das suas lavouras.</p>
        </div>

        {/* com uma única aba, a barra de abas seria só ruído */}
        {ABAS.length > 1 && (
          <nav className="hist-abas" role="tablist" aria-label="Seções do histórico">
            {ABAS.map((aba) => (
              <button
                key={aba.id}
                type="button"
                role="tab"
                aria-selected={abaAtiva === aba.id}
                className="hist-aba"
                onClick={() => setAbaAtiva(aba.id)}
              >
                {aba.nome}
              </button>
            ))}
          </nav>
        )}

        <section className="hist-painel">
          <ComponenteAba />
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
