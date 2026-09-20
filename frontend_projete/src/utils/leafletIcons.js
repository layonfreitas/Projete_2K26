// Corrige os ícones padrão do Leaflet quando empacotado pelo Vite.
// Antes isso rodava dentro de mapa.jsx e só "funcionava" nas outras telas
// porque todas as páginas eram carregadas juntas; com carregamento sob
// demanda (lazy) cada tela que usa marcadores precisa importar este módulo.
import L from "leaflet";
import icone from "leaflet/dist/images/marker-icon.png";
import icone2x from "leaflet/dist/images/marker-icon-2x.png";
import sombra from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconUrl: icone,
  iconRetinaUrl: icone2x,
  shadowUrl: sombra,
});
