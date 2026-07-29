import { useEffect, useState } from "react";
import { buscarClima } from "../services/ClimaAPI";
import { buscarLavouras } from "../services/LavouraAPI";
import { centroide } from "../utils/geo";
import "./ClimaCard.css";

export default function ClimaCard() {
  const usuarioId = localStorage.getItem("usuarioId");
  const cidadeUsuario = localStorage.getItem("usuarioCidade");
  const cidadeLat = localStorage.getItem("usuarioCidadeLat");
  const cidadeLon = localStorage.getItem("usuarioCidadeLon");

  const [lavouras, setLavouras] = useState([]);
  const [lavouraSelecionada, setLavouraSelecionada] = useState("");
  const [clima, setClima] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  // busca as lavouras do usuário ao montar
  useEffect(() => {
    if (!usuarioId) return;
    buscarLavouras(usuarioId)
      .then((dados) => {
        setLavouras(dados);
        if (dados.length > 0) setLavouraSelecionada(String(dados[0].id));
      })
      .catch(() => setErro("Não foi possível carregar suas lavouras."));
  }, [usuarioId]);

  // busca o clima: da lavoura selecionada, ou da cidade se não tiver nenhuma
  useEffect(() => {
    async function carregarClima() {
      setCarregando(true);
      setErro("");

      try {
        let lat, lon;

        if (lavouras.length > 0) {
          const lavoura = lavouras.find((l) => String(l.id) === lavouraSelecionada);
          if (!lavoura) return;
          const centro = centroide(lavoura.coordenadas);
          lat = centro.lat;
          lon = centro.lng;
        } else if (cidadeLat && cidadeLon) {
          lat = cidadeLat;
          lon = cidadeLon;
        } else {
          setCarregando(false);
          return;
        }

        const dados = await buscarClima(lat, lon);
        setClima(dados);
      } catch (e) {
        setErro("Não foi possível carregar o clima.");
        console.error(e);
      } finally {
        setCarregando(false);
      }
    }

    if (lavouras.length === 0 || lavouraSelecionada) {
      carregarClima();
    }
  }, [lavouras, lavouraSelecionada, cidadeLat, cidadeLon]);

  if (carregando) return <div className="clima-card">Carregando clima...</div>;
  if (erro) return <div className="clima-card clima-erro">{erro}</div>;
  if (!clima) return null;

  return (
    <div className="clima-card">
      {lavouras.length > 0 ? (
        <select
          value={lavouraSelecionada}
          onChange={(e) => setLavouraSelecionada(e.target.value)}
        >
          {lavouras.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nomeLavoura}
            </option>
          ))}
        </select>
      ) : (
        <p className="clima-origem">Clima em {cidadeUsuario}</p>
      )}

      <div className="clima-info">
        <span className="clima-temp">{Math.round(clima.temperatura)}°C</span>
        <span className="clima-descricao">{clima.descricao}</span>
      </div>

      <div className="clima-detalhes">
        <span>Sensação: {Math.round(clima.sensacao_termica)}°C</span>
        <span>Umidade: {clima.umidade}%</span>
        <span>Vento: {clima.vento} m/s</span>
      </div>
    </div>
  );
}