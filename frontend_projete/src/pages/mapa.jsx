import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./mapa.css";

import BottomNav from "../components/BottomNav";


import iconeMarcador from "leaflet/dist/images/marker-icon.png";
import iconeMarcador2x from "leaflet/dist/images/marker-icon-2x.png";
import iconeSombra from "leaflet/dist/images/marker-shadow.png";
import { AUTH_API_URL } from "../config/api";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: iconeMarcador2x,
  iconUrl: iconeMarcador,
  shadowUrl: iconeSombra,
});

export default function Mapa() {
  const navigate = useNavigate();

  const mapaRef = useRef(null);
  const map = useRef(null);

  const postos = useRef([]);
  const contadorPostos = useRef(0);
  const contornoLavoura = useRef(null);
  const previewLavoura = useRef(null);

  const [cidade, setCidade] = useState("");
  const [contornoCriado, setContornoCriado] = useState(false);


  useEffect(() => {
    if (map.current) return;

    // Retângulo que cobre todo o território brasileiro
    // (sudoeste -> nordeste)
    const limitesBrasil = L.latLngBounds(
      [-35.0, -75.0],
      [6.0, -32.0]
    );

    map.current = L.map(mapaRef.current, {
      center: [-14.2350, -51.9253],
      zoom: 4,
      minZoom: 4,
      maxBounds: limitesBrasil,
      maxBoundsViscosity: 1.0,
    });

    // Enquadra o Brasil por completo ao carregar
    map.current.fitBounds(limitesBrasil);

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Tiles © Esri",
      }
    ).addTo(map.current);

    carregarLavouras();

    map.current.on("click", (e) => {
      contadorPostos.current++;

      const lat = e.latlng.lat;
      const lng = e.latlng.lng;

      const marcador = L.marker([lat, lng]).addTo(map.current);

      const id = contadorPostos.current;

      marcador.bindPopup(`
        <b>Posto ${id}</b><br>
        Lat: ${lat.toFixed(6)}<br>
        Lng: ${lng.toFixed(6)}<br>
        <button id="remover-${id}">Remover</button>
      `);

      marcador.on("popupopen", () => {
        const botao = document.getElementById(`remover-${id}`);

        if (botao) {
          botao.onclick = () => removerPosto(id);
        }
      });

      postos.current.push({
        id,
        marcador,
        lat,
        lng,
      });

      atualizarPreview();
    });
  }, []);

  // Redesenha, a cada clique/remoção, um contorno "rascunho" (tracejado)
  // ligando os postos já marcados — assim o produtor vê a área tomando
  // forma em tempo real, antes de confirmar o contorno definitivo.
  function atualizarPreview() {
    if (previewLavoura.current) {
      map.current.removeLayer(previewLavoura.current);
      previewLavoura.current = null;
    }

    if (postos.current.length < 2) return;

    const coordenadas = postos.current.map((p) => [p.lat, p.lng]);

    const estiloPreview = {
      color: "#c6923c",
      weight: 3,
      dashArray: "6 8",
      fillColor: "#c6923c",
      fillOpacity: 0.12,
    };

    previewLavoura.current =
      postos.current.length === 2
        ? L.polyline(coordenadas, estiloPreview).addTo(map.current)
        : L.polygon(coordenadas, estiloPreview).addTo(map.current);
  }

  function removerPosto(id) {
    const index = postos.current.findIndex((p) => p.id === id);

    if (index === -1) return;

    map.current.removeLayer(postos.current[index].marcador);

    postos.current.splice(index, 1);

    atualizarPreview();

    if (contornoLavoura.current) {
    map.current.removeLayer(contornoLavoura.current);
    contornoLavoura.current = null;
    setContornoCriado(false);
}
  }

  async function buscarCidade() {
    if (!cidade.trim()) return;

    const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=br&q=${encodeURIComponent(
      cidade
    )}`;

    const response = await fetch(url);
    const dados = await response.json();

    if (dados.length === 0) {
      alert("Cidade não encontrada");
      return;
    }

    const lat = parseFloat(dados[0].lat);
    const lng = parseFloat(dados[0].lon);

    map.current.setView([lat, lng], 12);

    L.marker([lat, lng])
      .addTo(map.current)
      .bindPopup(dados[0].display_name)
      .openPopup();
  }
  

 function confirmarCadastro() {

  if (!contornoLavoura.current || postos.current.length < 3){
    alert("Nenhum contorno desenhado ou pontos insuficientes para cadastro.");
    return;
  }

  const coordenadas = postos.current.map((p) => ({
    lat: p.lat,
    lng: p.lng,
  }));

  navigate("/cadastro", {
        state: {
            coordenadas,
        },
    });
  }

  function confirmarContorno() {
    if (postos.current.length < 3) {
      alert("Marque pelo menos 3 pontos.");
      return;
    }

    if (contornoLavoura.current) {
      map.current.removeLayer(contornoLavoura.current);
    }

    if (previewLavoura.current) {
      map.current.removeLayer(previewLavoura.current);
      previewLavoura.current = null;
    }

    const coordenadas = postos.current.map((p) => [p.lat, p.lng]);

    contornoLavoura.current = L.polygon(coordenadas, {
      color: "#2e7d32",
      weight: 3,
      fillColor: "#2e7d32",
      fillOpacity: 0.3,
    }).addTo(map.current);

    setContornoCriado(true);
  }

  function apagarContorno() {
    if (!contornoLavoura.current) {
      alert("Nenhum contorno desenhado.");
      return;
    }

    map.current.removeLayer(contornoLavoura.current);
    contornoLavoura.current = null;

    setContornoCriado(false);

    atualizarPreview();
  }

  function desenharLavoura(coordenadas) {
  if (!map.current || !coordenadas || coordenadas.length < 3) {
    return;
  }

  const pontos = coordenadas.map((p) => [
    p.lat,
    p.lng,
  ]);

  L.polygon(pontos, {
    color: "#2e7d32",
    weight: 3,
    fillColor: "#2e7d32",
    fillOpacity: 0.3,
  }).addTo(map.current);
}

async function carregarLavouras() {
   const usuarioId = localStorage.getItem("usuarioId");
  const usuarioTipo = localStorage.getItem("usuarioTipo");
  const produtorSelecionadoId = localStorage.getItem("produtorSelecionadoId");

  const idParaBuscar =
    usuarioTipo === "agronomo" ? produtorSelecionadoId : usuarioId;

  if (!idParaBuscar) return;

  try {
    const resposta = await fetch(
      `${AUTH_API_URL}/lavouras/${idParaBuscar}`
    );

    const dados = await resposta.json();

    if (!resposta.ok) {
      console.error("Erro ao buscar lavouras:", dados);
      return;
    }

    console.log("Lavouras cadastradas:", dados);

    dados.forEach((lavoura) => {
      desenharLavoura(lavoura.coordenadas);
    });

  } catch (erro) {
    console.error("Erro ao carregar lavouras:", erro);
  }
}


  return (
    <div className="pagina-mapa">

      <div className="barra-superior">

        <input
          type="text"
          placeholder="Digite uma cidade..."
          value={cidade}
          onChange={(e) => setCidade(e.target.value)}
        />

        <button onClick={buscarCidade}>
          Buscar
        </button>

        <button onClick={confirmarContorno}>
          Confirmar Contorno
        </button>

        <button onClick={apagarContorno}>
          Apagar Contorno
        </button>

        {contornoCriado && (
          <button className="botao-confirmar-cadastro" onClick={confirmarCadastro}>
            Confirmar Cadastro
          </button>
        )}

      </div>

      <div
        ref={mapaRef}
        id="mapa"
      ></div>
       <BottomNav />    
    </div>
  );
}