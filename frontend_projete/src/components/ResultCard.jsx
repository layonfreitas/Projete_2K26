import { useEffect, useRef } from "react";
import Icon from "./ui/Icon";
import Button from "./ui/Button";
import "./ResultCard.css";

function ResultCard({ resultado, onNova }) {
  const temDoenca = resultado.doencas.length > 0;
  const ref = useRef(null);

  // No celular o resultado aparece abaixo da dobra: leva o usuário até ele.
  useEffect(() => {
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({ behavior: reduzir ? "auto" : "smooth", block: "nearest" });
  }, []);

  return (
    <section className="res-card" ref={ref} aria-live="polite">
      <div className="res-cabecalho">
        <span className={`res-status ${temDoenca ? "danger" : "success"}`} aria-hidden="true">
          <Icon nome={temDoenca ? "alerta" : "checkCirculo"} tamanho={22} />
        </span>

        <div>
          <h3>{temDoenca ? "Doenças Detectadas" : "Planta Saudável"}</h3>
          <span className="res-origem">Resultado da Inteligência Artificial</span>
        </div>
      </div>

      {!temDoenca && (
        <div className="res-sucesso">
          <p>{resultado.mensagem}</p>
        </div>
      )}

      {temDoenca && (
        <>
          <ul className="res-doencas">
            {resultado.doencas.map((doenca) => (
              <li className="res-doenca" key={doenca}>
                <Icon nome="inseto" tamanho={18} />
                {doenca}
              </li>
            ))}
          </ul>

          <div className="res-observacao">
            <strong>Observação</strong>
            <p>
              Recomendamos verificar a lavoura e realizar uma inspeção antes da aplicação de
              qualquer tratamento.
            </p>
          </div>
        </>
      )}

      {onNova && (
        <Button variant="secondary" icon="camera" block onClick={onNova}>
          Analisar outra folha
        </Button>
      )}
    </section>
  );
}

export default ResultCard;
