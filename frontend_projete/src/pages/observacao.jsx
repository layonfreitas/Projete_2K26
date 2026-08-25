import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import { AUTH_API_URL } from "../config/api";
import "./observacao.css";

export default function Observacao() {

  const { id } = useParams();

  const navigate = useNavigate();

  const [texto, setTexto] = useState("");

  function Sair() {
    navigate("/home");
  }

  async function salvarObservacao() {

    if (!texto.trim()) {
      alert("Digite uma observação antes de salvar.");
      return;
    }

    try {

      const resposta = await fetch(`${AUTH_API_URL}/observacoes`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          lavoura_id: id,
          texto: texto,
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          dados.erro || "Erro ao salvar observação."
        );
      }

      alert("Observação salva com sucesso!");

      setTexto("");

    } catch (error) {

      console.log("Erro ao salvar observação:", error);

      alert("Erro ao salvar observação. Tente novamente.");
    }
  }

  return (
    <div className="observacao-page">

      <div className="observacao-card">

        <h1>Observação da lavoura</h1>

        <p>
          Escreva aqui informações importantes sobre sua lavoura.
        </p>

        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Digite sua observação..."
        />

        <div className="observacao-acoes">

          <button onClick={Sair}>
            Sair
          </button>

          <button onClick={salvarObservacao}>
            Salvar observação
          </button>

        </div>

      </div>

    </div>
  );
}