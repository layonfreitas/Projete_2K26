export async function buscarJson(url, signal) {
  const controller = new AbortController();
  const cancelar = () => controller.abort();
  if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
  signal?.addEventListener('abort', cancelar, { once: true });
  const timer = setTimeout(cancelar, 60000);
  try {
    const resposta = await fetch(url, { signal: controller.signal });
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.mensagem || 'Não foi possível consultar o histórico.');
    return dados;
  } catch (erro) {
    if (controller.signal.aborted && !signal?.aborted) {
      throw new Error('O servidor demorou para responder. Tente novamente.', { cause: erro });
    }
    throw erro;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancelar);
  }
}

export function validarMapa(dados, lavouraId, usuarioId) {
  const meta = typeof dados.georreferencia === 'string'
    ? JSON.parse(dados.georreferencia) : dados.georreferencia;
  if (!meta || meta.versao !== 2) {
    throw new Error('Esta imagem foi gerada pela versão antiga. Reprocesse essa data para visualizar o mapa corrigido.');
  }
  if (meta.crs !== 'EPSG:3857' || String(meta.lavouraId) !== String(lavouraId)
      || String(meta.usuarioId) !== String(usuarioId)) {
    throw new Error('A localização da imagem não corresponde à lavoura selecionada.');
  }
  const b = meta.bounds;
  if (!Array.isArray(b) || b.length !== 2
      || !b.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))
      || !(b[0][0] > -85 && b[0][0] < b[1][0] && b[1][0] < 85)
      || !(b[0][1] >= -180 && b[0][1] < b[1][1] && b[1][1] <= 180)) {
    throw new Error('Os limites geográficos da imagem são inválidos.');
  }
  if (meta.geometria?.type !== 'Polygon' || !Array.isArray(meta.geometria.coordinates)
      || !meta.geometria.coordinates.length
      || !meta.geometria.coordinates.every(anel => Array.isArray(anel) && anel.length >= 4
        && anel.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)
          && p[0] >= b[0][1] - 1e-8 && p[0] <= b[1][1] + 1e-8
          && p[1] >= b[0][0] - 1e-8 && p[1] <= b[1][0] + 1e-8)
        && anel[0][0] === anel.at(-1)[0] && anel[0][1] === anel.at(-1)[1])) {
    throw new Error('O contorno da imagem é inválido.');
  }
  if (!dados.url || !/^https?:\/\//.test(dados.url)) throw new Error('A imagem não possui um endereço válido.');
  return meta;
}

export function indicesDaData(registro) {
  const disponiveis = registro?.indicesDisponiveis || [];
  return ['NDVI', 'NDRE', 'NDWI'].filter(i => disponiveis.includes(i) || disponiveis.includes(`z-score-${i}`));
}

export function selecionarRegistro(registro, anterior = {}) {
  const indices = indicesDaData(registro);
  const indice = indices.includes(anterior.indice) ? anterior.indice : indices[0] || '';
  const nomes = registro?.indicesDisponiveis || [];
  let modo = anterior.modo || 'indice';
  if (modo === 'zscore' && !nomes.includes(`z-score-${indice}`)) modo = 'indice';
  if (modo === 'indice' && !nomes.includes(indice) && nomes.includes(`z-score-${indice}`)) modo = 'zscore';
  return { data: registro?.data || '', indice, modo };
}
