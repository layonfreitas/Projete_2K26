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

const MENSAGENS = {
  NDVI: {
    critico:
      "Foi identificada uma alteração acentuada no comportamento " +
      "da vegetação. Consulte o mapa e verifique a área em campo.",
    atencao:
      "Foi identificada uma variação na vegetação que merece " +
      "acompanhamento. Consulte as áreas sinalizadas no mapa.",
  },

  NDRE: {
    critico:
      "Foi identificada uma alteração acentuada na resposta " +
      "espectral da vegetação. A causa precisa ser avaliada em campo.",
    atencao:
      "A resposta espectral da vegetação apresentou uma variação. " +
      "Acompanhe a área e registre as condições observadas.",
  },

  NDWI: {
    critico:
      "Foi identificada uma alteração acentuada no indicador " +
      "relacionado à água na vegetação. Verifique as condições em campo.",
    atencao:
      "Foi identificada uma variação no indicador relacionado " +
      "à água na vegetação. Acompanhe as áreas sinalizadas.",
  },

  CLMI: {
    critico:
      "A classificação automática sinalizou uma condição crítica. " +
      "Confirme o resultado com avaliação em campo.",
    atencao:
      "A classificação automática sinalizou uma condição que " +
      "merece acompanhamento.",
  },
};

function mensagemAlerta(indice, critico) {
  return (
    MENSAGENS[indice]?.[
      critico ? "critico" : "atencao"
    ] ||
    "Foi registrada uma alteração que precisa ser avaliada."
  );
}

function HistoricoAlerta() {
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
    const map = L.map(container.current, { center: [-14.235, -51.925], zoom: 4, maxZoom: 17, scrollWheelZoom: 'center', doubleClickZoom:'center',touchZoom:'center', masBoundsViscosity: 1});
    mapa.current = map;
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Tiles © Esri', maxNativeZoom: 19, maxZoom: 17 }).addTo(map);
    return () => { map.remove(); mapa.current = null; camada.current = null; contornoLayer.current = null; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    if (!usuarioId) return () => controller.abort();
    setConsultaLavouras({ carregando: true, erro: '' });
    buscarJson(`${AUTH_API_URL}/lavouras/${usuarioId}`, controller.signal).then(dados => {
      if (controller.signal.aborted) return;
      if (!Array.isArray(dados)) throw new Error('Resposta inválida ao consultar as lavouras.');
      setLavouras(dados);
      setLavouraId(anterior => dados.some(l => String(l.id) === anterior) ? anterior : String(dados[0]?.id || ''));
      setConsultaLavouras({ carregando: false, erro: '' });
    }).catch(e => {
      if (!controller.signal.aborted) setConsultaLavouras({ carregando: false, erro: e.message });
    });
    return () => controller.abort();
  }, [usuarioId]);

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
      map.setMinZoom(null);
      map.fitBounds(bounds, {padding: [45, 45], animate: false});
      map.setMinZoom(mapgetZoom()- 3);
      map.setMaxBounds(bounds.pad(1.5));
    }).catch(e => {
      if (!controller.signal.aborted) setEstadoMapa({ carregando: false, erro: e.message, dados: null });
    });

    return () => { controller.abort(); if (layer) layer.off(); };
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
              <p className="hist-alerta-vazio">Nenhum alerta registrado para esta lavoura.</p>
            )}

            <ul className="hist-alerta-itens">
              {alertas.map(alerta => (
                <li key={alerta.id}>
                  <button
                    type="button"
                    className={`hist-alerta-item ${alertaSelecionadoId === alerta.id ? 'ativo' : ''}`}
                    onClick={() => setAlertaSelecionadoId(alerta.id)}
                  >
                    <span className={`hist-alerta-badge ${alerta.critico ? 'critico' : 'atencao'}`}>
                      {alerta.critico ? 'Crítico' : 'Atenção'}
                    </span>
                    <strong>{alerta.indice}</strong>
                    <p>{mensagemAlerta(alerta.indice, alerta.critico)}</p>
                  </button>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="lixeira"
                    className="ui-btn--icon hist-alerta-excluir"
                    aria-label="Excluir alerta"
                    title="Excluir alerta"
                    disabled={excluindoId === alerta.id}
                    onClick={() => excluirAlerta(alerta.id)}
                  />
                </li>
              ))}
            </ul>
          </aside>

          <div className="hist-alerta-visao">
            <div className="hist-alerta-mapa-caixa">
              <div ref={container} className="hist-alerta-mapa" aria-label="Mapa do alerta" />
              {!alertaSelecionado && (
                <div className="hist-alerta-status-mapa">Selecione um alerta para ver os detalhes.</div>
              )}
              {alertaSelecionado && !temMapa && (
                <div className="hist-alerta-status-mapa">Este alerta não possui mapa associado.</div>
              )}
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
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Historico() {
  const [abaAtiva, setAbaAtiva] = useState(ABAS[0].id);

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