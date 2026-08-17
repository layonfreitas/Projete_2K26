import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { AUTH_API_URL } from "../config/api";
import "./Cadastro.css";

export default function Cadastro() {

  const navigate = useNavigate();

  const location = useLocation();
  const coordenadas = location.state?.coordenadas;

  const [nome, setNome] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function salvarCadastro() {
    const usuarioId = localStorage.getItem("usuarioId");

     console.log("USUARIO ID:", usuarioId);
  console.log("NOME:", nome);
  console.log("COORDENADAS:", coordenadas);

    if (!nome || !coordenadas) {
      setMensagem("Preencha o nome da lavoura e desenhe o polígono no mapa.");
      return;
    }

    setCarregando(true);
    setMensagem("");

    try {
      const resposta = await fetch(`${AUTH_API_URL}/lavoura`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario_id: usuarioId,
          nomeLavoura: nome,
          coordenadas,
        }),
      });

      const dados = await resposta.json();

      if (resposta.ok) {
        setMensagem("Lavoura cadastrada com sucesso!");
        setTimeout(() => navigate("/home"), 1500);
      } else {
        setMensagem(dados.mensagem || "Erro ao cadastrar lavoura.");
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

          {mensagem && <p className="mensagem-cadastro">{mensagem}</p>}

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
              {carregando ? "Salvando..." : "Salvar Cadastro"}
            </button>

          </div>

        </div>

      </div>

    </div>

  );
}