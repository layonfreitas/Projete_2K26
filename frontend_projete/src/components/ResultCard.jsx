import "./ResultCard.css";

function ResultCard({ resultado }) {

  const temDoenca = resultado.doencas.length > 0;

  return (
    <section className="result-card">

      <div className="result-header">

        <div
          className={`status ${temDoenca ? "danger" : "success"}`}
        >
          {temDoenca ? "⚠" : "✔"}
        </div>

        <div>

          <h3>
            {temDoenca
              ? "Doenças Detectadas"
              : "Planta Saudável"}
          </h3>

          <span>
            Resultado da Inteligência Artificial
          </span>

        </div>

      </div>

      {!temDoenca && (

        <div className="resultado-sucesso">

          <p>{resultado.mensagem}</p>

        </div>

      )}

      {temDoenca && (

        <div>

          <div className="lista-doencas">

            {resultado.doencas.map((doenca, index) => (

              <div
                className="doenca"
                key={index}
              >

                🌿 {doenca}

              </div>

            ))}

          </div>

          <div className="observacao">

            <strong>Observação</strong>

            <p>
              Recomendamos verificar a lavoura e realizar uma inspeção
              antes da aplicação de qualquer tratamento.
            </p>

          </div>

        </div>

      )}

    </section>
  );
}

export default ResultCard;