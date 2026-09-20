// Cálculo de área de um polígono (em hectares) a partir de pontos {lat, lng}.
// Antes essa função estava copiada em Cadastro, Mapa e (agora) Edição.

export function calcularAreaHectares(coordenadas) {
  if (!coordenadas || coordenadas.length < 3) return 0;

  const R = 6371000;
  const latMedia =
    coordenadas.reduce((soma, ponto) => soma + ponto.lat, 0) / coordenadas.length;
  const latMediaRad = (latMedia * Math.PI) / 180;

  const pontos = coordenadas.map((ponto) => ({
    x: ((ponto.lng * Math.PI) / 180) * R * Math.cos(latMediaRad),
    y: ((ponto.lat * Math.PI) / 180) * R,
  }));

  let area = 0;
  for (let i = 0; i < pontos.length; i++) {
    const atual = pontos[i];
    const proximo = pontos[(i + 1) % pontos.length];
    area += atual.x * proximo.y - proximo.x * atual.y;
  }

  return Math.abs(area) / 2 / 10000; // m² → hectares
}

export function formatarHectares(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return "";
  return `${n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ha`;
}

// Converte pontos em coordenadas de um SVG (viewBox 0 0 largura altura),
// mantendo a proporção, para desenhar uma miniatura do contorno.
export function pontosParaSvg(coordenadas, largura = 240, altura = 160, margem = 14) {
  if (!coordenadas || coordenadas.length < 3) return "";

  const lats = coordenadas.map((p) => p.lat);
  const lngs = coordenadas.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  // corrige a distorção de longitude pela latitude média
  const fator = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const larguraGeo = Math.max((maxLng - minLng) * fator, 1e-9);
  const alturaGeo = Math.max(maxLat - minLat, 1e-9);

  const escala = Math.min(
    (largura - margem * 2) / larguraGeo,
    (altura - margem * 2) / alturaGeo
  );

  const desvioX = (largura - larguraGeo * escala) / 2;
  const desvioY = (altura - alturaGeo * escala) / 2;

  return coordenadas
    .map((p) => {
      const x = desvioX + (p.lng - minLng) * fator * escala;
      const y = altura - (desvioY + (p.lat - minLat) * escala);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
