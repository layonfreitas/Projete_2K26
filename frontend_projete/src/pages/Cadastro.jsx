import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { AUTH_API_URL } from "../config/api";
import "./Cadastro.css";

function calcularAreaHectares(coordenadas) {
  if (!coordenadas || coordenadas.length < 3) {
    return 0;
  }

  const R = 6371000;

  const latMedia =
    coordenadas.reduce(
      (soma, ponto) => soma + ponto.lat,
      0
    ) / coordenadas.length;

  const latMediaRad = (latMedia * Math.PI) / 180;

  const pontos = coordenadas.map((ponto) => {
    const x =
      ((ponto.lng * Math.PI) / 180) *
      R *
      Math.cos(latMediaRad);

    const y =
      ((ponto.lat * Math.PI) / 180) *
      R;

    return { x, y };
  });

  let area = 0;

  for (let i = 0; i < pontos.length; i++) {
    const pontoAtual = pontos[i];
    const proximoPonto =
      pontos[(i + 1) % pontos.length];

    area +=
      pontoAtual.x * proximoPonto.y -
      proximoPonto.x * pontoAtual.y;
  }

  const areaM2 = Math.abs(area) / 2;

  return areaM2 / 10000; // converte m² para hectares
}
export default function Cadastro() {
  const navigate = useNavigate();
  const location = useLocation();

  const coordenadas = location.state?.coordenadas;

  const [nome, setNome] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(false);

  const areaM2 = calcularAreaM2(coordenadas);

  async function salvarCadastro() {
    const usuarioId = localStorage.getItem("usuarioId");

    console.log("USUARIO ID:", usuarioId);
    console.log("NOME:", nome);
    console.log("COORDENADAS:", coordenadas);

    if (!nome || !coordenadas) {
      setMensagem(
        "Preencha o nome da lavoura e desenhe o polígono no mapa."
      );
      return;
    }

    setCarregando(true);
    setMensagem("");

    try {
      const resposta = await fetch(`${AUTH_API_URL}/lavoura`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          usuarioId: usuarioId,
          nomeLavoura: nome,
          coordenadas,
        }),
      });

      const dados = await resposta.json();

      if (resposta.ok) {
        setMensagem("Lavoura cadastrada com sucesso!");

        setTimeout(() => navigate("/home"), 1500);
      } else {
        setMensagem(
          dados.mensagem || "Erro ao cadastrar lavoura."
        );
      }
    } catch (erro) {
      setMensagem("Erro ao conectar com o servidor.");
      console.error(erro);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="cadastro-container">
      <div className="cadastro-card">

        <div className="cadastro-header">
          <h1>🌱 Cadastro da Lavoura</h1>

          <p>
            Preencha as informações da área cadastrada.
          </p>
        </div>

        <div className="formulario">

          <div className="campo">
            <label>Nome da lavoura</label>

            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Lavoura Boa Vista"
            />
          </div>

          <div className="info-poligono">
            <strong>Polígono recebido:</strong>

            <br />

            {coordenadas
              ? `${coordenadas.length} pontos marcados no mapa.`
              : "Nenhum polígono recebido."}
          </div>

          <div className="info-area">
            <strong>Área da lavoura:</strong>

            <br />

            {coordenadas && coordenadas.length >= 3
              ? `${areaM2.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} ha`
              : "Área indisponível."}
          </div>

          {mensagem && (
            <p className="mensagem-cadastro">
              {mensagem}
            </p>
          )}

          <div className="botoes">

            <button
              className="botao-voltar"
              onClick={() => navigate("/mapa")}
            >
              Voltar
            </button>

            <button
              className="botao-salvar"
              onClick={salvarCadastro}
              disabled={carregando}
            >
              {carregando
                ? "Salvando..."
                : "Salvar Cadastro"}
            </button>

          </div>

        </div>
      </div>
    </div>
  );
}