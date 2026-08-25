import { useState, useEffect } from "react";
import { buscarClima } from "../services/climaAPI";
import "./ClimaBanner.css";
import { useNavigate } from "react-router-dom";

// calcula o centro aproximado do polígono da lavoura, pra consultar o
// clima de um ponto representativo da área (em vez de só o 1º vértice)
function centroide(coordenadas) {
  const soma = coordenadas.reduce(
    (acc, ponto) => ({ lat: acc.lat + ponto.lat, lng: acc.lng + ponto.lng }),
    { lat: 0, lng: 0 }
  );

  return {
    lat: soma.lat / coordenadas.length,
    lng: soma.lng / coordenadas.length,
  };
}

function ClimaBanner({ lavouras }) {
  // id da lavoura selecionada no seletor (quando houver mais de uma)
  const [lavouraId, setLavouraId] = useState(null);

  const [clima, setClima] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const produtorSelecionadoNome = localStorage.getItem("produtorSelecionadoNome");
  const usuarioTipo = localStorage.getItem("usuarioTipo");
  const navigate = useNavigate();

  // assim que a lista de lavouras chega, seleciona a primeira por padrão
  useEffect(() => {
    if (lavouras && lavouras.length > 0 && lavouraId === null) {
      setLavouraId(lavouras[0].id);
    }
  }, [lavouras, lavouraId]);

  const lavouraSelecionada = lavouras?.find((l) => l.id === lavouraId);

       function observacao() {
    navigate("/observacao");
  }

  useEffect(() => {
    if (!lavouraSelecionada?.coordenadas?.length) return;

    async function carregarClima() {
      setCarregando(true);
      setErro("");

      try {
        const { lat, lng } = centroide(lavouraSelecionada.coordenadas);
        const dados = await buscarClima(lat, lng);
        setClima(dados);
      } catch (erroRequisicao) {
        setErro(erroRequisicao.message || "Erro ao conectar com o serviço de clima.");
        console.error(erroRequisicao);
      } finally {
        setCarregando(false);
      }
    }


    carregarClima();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lavouraSelecionada?.id]);

  // sem lavoura cadastrada ainda, não mostra o banner
  if (!lavouras || lavouras.length === 0) return null;

  return (
    <div className="clima-banner">
      <div className="clima-banner-topo">
        <h3>
          🌦️ Clima {lavouraSelecionada ? `— ${lavouraSelecionada.nomeLavoura}` : ""}
        </h3>

        {lavouras.length > 1 && (
          <select
            className="clima-banner-select"
            value={lavouraId ?? ""}
            onChange={(evento) => setLavouraId(Number(evento.target.value))}
          >
            {lavouras.map((lavoura) => (
              <option key={lavoura.id} value={lavoura.id}>
                {lavoura.nomeLavoura}
              </option>
            ))}
          </select>
        )}
      </div>

      {carregando && <p className="clima-banner-status">Carregando clima...</p>}

      {!carregando && erro && (
        <p className="clima-banner-status clima-banner-erro">{erro}</p>
      )}
    
      {!carregando && !erro && clima && (
        <div className="clima-banner-dados">
          <span>🌡️ {clima.temperatura}°C</span>
          <span>💧 {clima.umidade}%</span>
          <span>🌬️ {clima.vento} m/s</span>
          <span>☁️ {clima.condicao}</span>
          {produtorSelecionadoNome && (
            <span>👨‍🌾 Produtor: {produtorSelecionadoNome}</span>
          )}
          {usuarioTipo === "agronomo" && (
            <button type="button" onClick={observacao}>
              adicionar observação
            </button>
          )}
        </div>
      )}

    </div>
  );
}

export default ClimaBanner;