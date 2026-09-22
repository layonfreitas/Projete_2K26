import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AUTH_API_URL } from '../config/api';
import { buscarJson, validarMapa, indicesDaData, selecionarRegistro } from '../services/historicoAPI';
import Button from './ui/Button';
import Icon from './ui/Icon';
import './historicoMapas.css';
import { fetchAutenticado } from "../services/apiAutenticado";

const estilo = { color: '#2f4a33', weight: 2, fill: false };
const formatarData = data => data ? data.slice(0, 10).split('-').reverse().join('/') : '';
const INDICES = ['NDVI', 'NDRE', 'NDWI'];

export default function HistoricoMapas() {
  const container = useRef(null);
  const mapa = useRef(null);
  const camada = useRef(null);
  const contorno = useRef(null);
  const limitesAtuais = useRef(null);
  const usuarioId = localStorage.getItem('usuarioTipo') === 'agronomo'
    ? localStorage.getItem('produtorSelecionadoId') : localStorage.getItem('usuarioId');
  const [lavouras, setLavouras] = useState([]);
  const [lavouraId, setLavouraId] = useState('');
  const [consultaLavouras, setConsultaLavouras] = useState({ chave: '', erro: '' });
  const [historico, setHistorico] = useState({ id: '', itens: [], carregando: false, erro: '' });
  const [selecao, setSelecao] = useState({ data: '', indice: '', modo: 'indice' });
  const [estadoMapa, setEstadoMapa] = useState({ chave: '', carregando: false, erro: '', dados: null });
  const [opacidade, setOpacidade] = useState(0.8);
  const [atualizacao, setAtualizacao] = useState(0);
  const lavoura = lavouras.find(l => String(l.id) === lavouraId);
  const chaveLavouras = `${usuarioId}/${atualizacao}`;
  const historicoAtual = historico.id === lavouraId && historico.atualizacao === atualizacao;
  const itens = historicoAtual ? historico.itens : [];
  const registro = itens.find(
    item =>
      item.data === selecao.data &&
      item.contorno === selecao.contorno
  );
  const indiceBanco = selecao.modo === 'zscore' ? `z-score-${selecao.indice}` : selecao.indice;
  const disponivel = registro?.indicesDisponiveis.includes(indiceBanco);
  const chave = disponivel
    ? `${usuarioId}/${lavouraId}/${selecao.data}/${indiceBanco}/${selecao.contorno}`
    : "";
  const exibicao = estadoMapa.chave === chave && estadoMapa.atualizacao === atualizacao ? estadoMapa : { carregando: Boolean(chave), erro: '', dados: null };
  const [gerando, setGerando] = useState(false);
  const [avisoGeracao, setAvisoGeracao] = useState("");
  useEffect(() => {
    const map = L.map(container.current, { center: [-14.235, -51.925], zoom: 4, maxZoom: 17, trackResize: false });
    mapa.current = map;
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Tiles © Esri', maxNativeZoom: 19, maxZoom: 17 }).addTo(map);
    const observer = new ResizeObserver(() => {
      map.stop();
      map.invalidateSize({ pan: false });
      if (limitesAtuais.current) map.fitBounds(limitesAtuais.current, { padding: [40, 40], animate: false });
    });
    observer.observe(container.current);
    return () => { observer.disconnect(); map.remove(); mapa.current = null; camada.current = null; contorno.current = null; limitesAtuais.current = null; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    if (!usuarioId) return () => controller.abort();
    buscarJson(`${AUTH_API_URL}/lavouras/${usuarioId}`, controller.signal).then(dados => {
      if (controller.signal.aborted) return;
      if (!Array.isArray(dados)) throw new Error('Resposta inválida ao consultar as lavouras.');
      setLavouras(dados);
      setLavouraId(anterior => dados.some(l => String(l.id) === anterior) ? anterior : String(dados[0]?.id || ''));
      setConsultaLavouras({ chave: chaveLavouras, erro: '' });
    }).catch(e => {
      if (!controller.signal.aborted) setConsultaLavouras({ chave: chaveLavouras, erro: e.message });
    });
    return () => controller.abort();
  }, [usuarioId, chaveLavouras]);

  useEffect(() => {
    const map = mapa.current;
    if (camada.current) return;
    if (contorno.current) { map.removeLayer(contorno.current); contorno.current = null; }
    if (!lavoura) return;
    try {
      const pontos = typeof lavoura.coordenadas === 'string' ? JSON.parse(lavoura.coordenadas) : lavoura.coordenadas;
      const layer = pontos?.type === 'Polygon' ? L.geoJSON(pontos, { style: estilo })
        : L.polygon(pontos.map(p => [Number(p.lat ?? p[0]), Number(p.lng ?? p[1])]), estilo);
      if (layer.getBounds().isValid()) { contorno.current = layer.addTo(map); limitesAtuais.current = layer.getBounds(); map.fitBounds(layer.getBounds(), { padding: [40, 40], animate: false }); }
    } catch { /* A imagem, quando existir, tem seu próprio contorno validado. */ }
  }, [lavoura]);

  useEffect(() => {
    const controller = new AbortController();
    if (!lavouraId || !usuarioId) return () => controller.abort();
    buscarJson(`${AUTH_API_URL}/imagens/${lavouraId}?usuario_id=${usuarioId}`, controller.signal).then(dados => {
      if (controller.signal.aborted) return;
      if (!Array.isArray(dados)) throw new Error('Resposta inválida ao consultar as datas.');
      const itens = dados.filter(item => indicesDaData(item).length).sort((a, b) => b.data.localeCompare(a.data));
      setHistorico({ id: lavouraId, atualizacao, itens, erro: '' });
           setSelecao(anterior =>
        selecionarRegistro(
          itens.find(
            item =>
              item.data === anterior.data &&
              item.contorno === anterior.contorno
          ) || itens[0],
          anterior
        )
      );
    }).catch(e => {
      if (!controller.signal.aborted) setHistorico({ id: lavouraId, atualizacao, itens: [], erro: e.message });
    });
    return () => controller.abort();
  }, [lavouraId, usuarioId, atualizacao]);

  useEffect(() => {
    const controller = new AbortController();
    const map = mapa.current;
    let layer;
    let timer;
    if (!chave || !map) return () => controller.abort();
       const [usuario, id, data, indice, contornoId] = chave.split("/");

    const params = new URLSearchParams({
      usuario_id: usuario,
      id,
      data,
      indice,
      contorno: contornoId,
    });
    const falhou = mensagem => {
      if (controller.signal.aborted) return;
      clearTimeout(timer);
      if (layer) map.removeLayer(layer);
      if (camada.current === layer) camada.current = null;
      setEstadoMapa({ chave, atualizacao, carregando: false, erro: mensagem, dados: null });
    };
    buscarJson(`${AUTH_API_URL}/acessar_imagem?${params}`, controller.signal).then(dados => {
      if (controller.signal.aborted) return;
      const meta = validarMapa(dados, id, usuario);
      const bounds = L.latLngBounds(meta.bounds);
      limitesAtuais.current = bounds;
      if (contorno.current) map.removeLayer(contorno.current);
      contorno.current = L.geoJSON(meta.geometria, { style: estilo }).addTo(map);
      layer = L.imageOverlay(dados.url, bounds, { opacity: 0, interactive: false });
      camada.current = layer;
      timer = setTimeout(() => falhou('A imagem demorou para carregar. Tente novamente.'), 60000);
      layer.once('load', () => {
        if (controller.signal.aborted || camada.current !== layer) return;
        clearTimeout(timer);
        setEstadoMapa({ chave, atualizacao, carregando: false, erro: '', dados: { ...dados, georreferencia: meta } });
      });
      layer.once('error', () => falhou('Não foi possível baixar a imagem. Tente novamente.'));
      layer.addTo(map);
      map.fitBounds(bounds, { padding: [45, 45], animate: false });
    }).catch(e => falhou(e.message));
    return () => {
      controller.abort(); clearTimeout(timer);
      if (layer) {
        // O evento remove libera os listeners internos do Leaflet antes do off.
        if (mapa.current === map) map.removeLayer(layer);
        layer.off();
      }
      if (camada.current === layer) camada.current = null;
    };
  }, [chave, atualizacao]);

  useEffect(() => { camada.current?.setOpacity(opacidade); }, [opacidade, estadoMapa]);
    async function gerarImagens() {
    setGerando(true);
    setAvisoGeracao("Solicitando geração…");

    try {
      const resposta = await fetchAutenticado(
        `${AUTH_API_URL}/lavoura/${lavouraId}/gerar-imagens`,
        { method: "POST" }
      );

      const dados = await resposta.json();

      setAvisoGeracao(
        dados.mensagem || "Não foi possível solicitar a geração."
      );
    } catch {
      setAvisoGeracao(
        "Não foi possível confirmar a solicitação. " +
        "Consulte o histórico antes de tentar novamente."
      );
    } finally {
      setGerando(false);
    }
  }


  const meta = exibicao.dados?.georreferencia;
  const vis = meta?.visualizacao;
  const erro = !usuarioId ? 'Selecione um produtor ou entre novamente na sua conta.' : (consultaLavouras.chave === chaveLavouras ? consultaLavouras.erro : '') || (historicoAtual ? historico.erro : '') || exibicao.erro;
  const carregando = Boolean(usuarioId) && (consultaLavouras.chave !== chaveLavouras || (Boolean(lavouraId) && !historicoAtual) || exibicao.carregando);
  const semLavouras = Boolean(usuarioId) && consultaLavouras.chave === chaveLavouras && !consultaLavouras.erro && lavouras.length === 0;
  const indicesDoRegistro = indicesDaData(registro);
  return (
    <div className="hm">
      <div className="hm-barra">
        <div className="ui-field hm-lavoura">
          <label htmlFor="historico-lavoura">Lavoura</label>
          <select id="historico-lavoura" value={lavouraId} onChange={e => { setLavouraId(e.target.value); setSelecao({ data: '', indice: '', modo: 'indice' }); }} disabled={!lavouras.length}>
            {!lavouras.length && <option value="">Nenhuma lavoura cadastrada</option>}
            {lavouras.map(l => <option key={l.id} value={l.id}>{l.nomeLavoura}</option>)}
          </select>
          
        </div>
        <Button variant="secondary" size="sm" icon="atualizar" className="ui-btn--icon hm-atualizar" aria-label="Atualizar histórico" title="Atualizar histórico" onClick={() => setAtualizacao(n => n + 1)} />
      </div>
      
      {avisoGeracao && (
        <p role="status">{avisoGeracao}</p>
      )}

      <div className="hm-area">
        <aside className="hm-datas" aria-label="Datas disponíveis">
          <h3 className="hm-datas-titulo"><Icon nome="calendario" tamanho={16} /> Imagens disponíveis</h3>
          {!itens.length && !carregando && <p className="hm-sem-imagens">{semLavouras ? 'Nenhuma lavoura cadastrada ainda.' : 'Nenhuma imagem disponível para esta lavoura.'}</p>}
          <ul className="hm-datas-lista">
                        {itens.map(item => {
              const selecionado =
                item.data === selecao.data &&
                item.contorno === selecao.contorno;

              return (
                <li key={`${item.data}/${item.contorno}`}>
                  <button
                    className={`hm-data ${selecionado ? "ativa" : ""}`}
                    aria-pressed={selecionado}
                    onClick={() =>
                      setSelecao(anterior =>
                        selecionarRegistro(item, anterior)
                      )
                    }
                  >
                    <strong>
                      {formatarData(item.data)}
                    </strong>

                    <span>
                      Contorno {item.versaoContorno}
                    </span>

                    <span className="hm-data-indices">
                      {indicesDaData(item).map(indice => (
                        <i key={indice}>{indice}</i>
                      ))}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <div className="hm-visao">
          <div className="hm-controles">
            <div className="hm-segmentos" role="group" aria-label="Índice de vegetação">
              {INDICES.map(i => <button key={i} aria-pressed={selecao.indice === i} disabled={!registro || !indicesDoRegistro.includes(i)} onClick={() => setSelecao(a => selecionarRegistro(registro, { ...a, indice: i }))}>{i}</button>)}
            </div>
            <div className="hm-segmentos" role="group" aria-label="Modo de exibição">
              <button aria-pressed={selecao.modo === 'indice'} disabled={!registro?.indicesDisponiveis.includes(selecao.indice)} onClick={() => setSelecao(a => ({ ...a, modo: 'indice' }))}>Índice</button>
              <button aria-pressed={selecao.modo === 'zscore'} disabled={!registro?.indicesDisponiveis.includes(`z-score-${selecao.indice}`)} onClick={() => setSelecao(a => ({ ...a, modo: 'zscore' }))}>Z-score</button>
            </div>
          </div>

          <div className="hm-mapa-caixa">
            <div ref={container} className="hm-mapa" aria-label="Mapa da lavoura" />
            {carregando && <div className="hm-status" role="status"><span className="ui-spinner" aria-hidden="true" /> Carregando histórico…</div>}
            {erro && <div className="hm-erro" role="alert">
              <Icon nome="alertaCirculo" tamanho={22} />
              <p>{erro}</p>
              {usuarioId && <Button variant="secondary" size="sm" icon="atualizar" onClick={() => setAtualizacao(n => n + 1)}>Tentar novamente</Button>}
            </div>}
          </div>

          {meta && <div className="hm-legenda" aria-label="Legenda do mapa">
            <strong>{selecao.indice}{selecao.modo === 'zscore' ? ' · Z-score robusto' : ''} · {formatarData(selecao.data)}</strong>
            {Number.isFinite(meta.coberturaValida) && <span>Cobertura válida: {(meta.coberturaValida * 100).toFixed(0)}% da lavoura</span>}
            {vis?.tipo === 'zscore' ? <div className="hm-cores">{vis.palette.map((cor, i) => <span key={cor}><i style={{ background: `#${cor}` }} />{vis.rotulos[i]}</span>)}</div>
              : vis?.palette && <div className="hm-escala"><span>{vis.min}</span><div style={{ background: `linear-gradient(to right, ${vis.palette.map(c => `#${c}`).join(',')})` }} /><span>{vis.max}</span></div>}
            {selecao.modo === 'indice' && exibicao.dados.valor_indice != null && <span>Média na área válida: {Number(exibicao.dados.valor_indice).toFixed(3)}</span>}
            <label className="hm-opacidade">
              <span>Opacidade da imagem</span>
              <input type="range" min="0.2" max="1" step="0.05" value={opacidade} onChange={e => setOpacidade(Number(e.target.value))} />
              <output>{Math.round(opacidade * 100)}%</output>
            </label>
          </div>}
        </div>
      </div>
    </div>
  );
  
}
