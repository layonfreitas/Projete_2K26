
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import { AUTH_API_URL } from "../config/api";
import "./observacao_produtor.css";

export default function Observacoes() {

  const { id } = useParams();
  const navigate = useNavigate();

  const [observacoes, setObservacoes] = useState([]);

  useEffect(() => {

    async function carregarObservacoes() {

      try {

        const resposta = await fetch(
          `${AUTH_API_URL}/observacoes/${id}`
        );

        const dados = await resposta.json();

        if (!resposta.ok) {
          throw new Error(
            dados.erro || "Erro ao buscar observações."
          );
        }

        setObservacoes(dados);

      } catch (erro) {

        console.error(
          "Erro ao carregar observações:",
          erro
        );

      }
    }

    carregarObservacoes();

  }, [id]);

  function voltar() {
    navigate(-1);
  }

  return (
    <div className="observacoes-page">

      <div className="observacoes-card">

        <h1>Observações da lavoura</h1>

        <p>
          Aqui estão as observações registradas para esta lavoura.
        </p>

        <div className="lista-observacoes">

          {observacoes.length === 0 ? (

            <p className="sem-observacoes">
              Nenhuma observação cadastrada.
            </p>

          ) : (

            observacoes.map((observacao) => (

              <div
                className="observacao-item"
                key={observacao.id}
              >
                <p>
                  {observacao.texto}
                </p>
              </div>

            ))

          )}

        </div>

        <div className="observacoes-acoes">

          <button onClick={voltar}>
            Voltar
          </button>

        </div>

      </div>

    </div>
  );
}

