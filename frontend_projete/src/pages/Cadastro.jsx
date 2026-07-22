import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import "./cadastro.css";

export default function Cadastro() {

  const navigate = useNavigate();

  const location = useLocation();
  const coordenadas = location.state?.coordenadas;

  const [nome, setNome] = useState("");
  const [proprietario, setProprietario] = useState("");

  function salvarCadastro() {

    const lavoura = {
      nome,
      proprietario,
      coordenadas
    };

    console.log(lavoura);

    // Aqui futuramente será feito o fetch para a API.
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

          <div className="campo">

            <label>Proprietário</label>

            <input
              type="text"
              value={proprietario}
              onChange={(e) => setProprietario(e.target.value)}
              placeholder="Nome do proprietário"
            />

          </div>

          <div className="info-poligono">

            <strong>Polígono recebido:</strong>

            <br />

            {coordenadas
              ? `${coordenadas.length} pontos marcados no mapa.`
              : "Nenhum polígono recebido."}

          </div>

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
            >
              Salvar Cadastro
            </button>

          </div>

        </div>

      </div>

    </div>

  );
}