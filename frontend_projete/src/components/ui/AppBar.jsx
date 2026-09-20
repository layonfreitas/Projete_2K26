import { useLocation, useNavigate } from "react-router-dom";
import Icon from "./Icon";

// Barra de topo das telas internas: voltar + título (+ ações à direita).
// `para` é para onde ir quando não há histórico (ex.: abriu o link direto).
export default function AppBar({ titulo, subtitulo, para = "/home", acoes, semVoltar = false }) {
  const navigate = useNavigate();
  const location = useLocation();

  function voltar() {
    if (location.key !== "default") navigate(-1);
    else navigate(para);
  }

  return (
    <header className={`ui-barra ${semVoltar ? "ui-barra--sem-voltar" : ""}`}>
      {!semVoltar && (
        <button
          type="button"
          className="ui-btn ui-btn--ghost ui-btn--icon"
          onClick={voltar}
          aria-label="Voltar"
        >
          <Icon nome="voltar" />
        </button>
      )}
      <div className="ui-barra-texto">
        <h1>{titulo}</h1>
        {subtitulo && <p>{subtitulo}</p>}
      </div>
      {acoes && <div className="ui-barra-acoes">{acoes}</div>}
    </header>
  );
}
