import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./mapa.css";

export default function Mapa() {
  const navigate = useNavigate();

  const mapaRef = useRef(null);
  const map = useRef(null);

  const postos = useRef([]);
  const contadorPostos = useRef(0);
  const contornoLavoura = useRef(null);

  const [cidade, setCidade] = useState("");
  const [contornoCriado, setContornoCriado] = useState(false);


  useEffect(() => {
    if (map.current) return;

    map.current = L.map(mapaRef.current).setView([-14.2350, -51.9253], 4);

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Tiles © Esri",
      }
    ).addTo(map.current);

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

      console.log(postos.current);
    });
  }, []);

  function removerPosto(id) {
    const index = postos.current.findIndex((p) => p.id === id);

    if (index === -1) return;

    map.current.removeLayer(postos.current[index].marcador);

    postos.current.splice(index, 1);

    console.log(postos.current);

    if (contornoLavoura.current) {
    map.current.removeLayer(contornoLavoura.current);
    contornoLavoura.current = null;
    setContornoCriado(false);
}
  }

  async function buscarCidade() {
    if (!cidade.trim()) return;

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
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
  

async function confirmarCadastro() {

  if (!contornoLavoura.current || postos.current.length < 3){
    alert("Nenhum contorno desenhado ou pontos insuficientes para cadastro.");
    return;
  }

  const coordenadas = postos.current.map((p) => ({
    lat: p.lat,
    lng: p.lng,
  }));

  const resposta = await fetch("http://localhost:3000/lavouras", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      nome: "Minha lavoura",
      coordenadas
    })
  });

  if (resposta.ok) {
    alert("Cadastro realizado!");
    navigate("/home");
    setCadastroConfirmado(true);
  }
}

  function confirmarContorno() {
    if (postos.current.length < 3) {
      alert("Marque pelo menos 3 pontos.");
      return;
    }

    if (contornoLavoura.current) {
      map.current.removeLayer(contornoLavoura.current);
    }

    const coordenadas = postos.current.map((p) => [p.lat, p.lng]);

    contornoLavoura.current = L.polygon(coordenadas, {
      color: "#ff0000",
      weight: 3,
      fillColor: "#ff0000",
      fillOpacity: 0.35,
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
          <button onClick={confirmarCadastro}>
            Confirmar Cadastro
          </button>
        )}

      </div>

      <div
        ref={mapaRef}
        id="mapa"
      ></div>

    </div>
  );
}