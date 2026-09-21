import { useId, useState } from "react";
import Icon from "./Icon";

// Campo com rótulo visível (nunca só placeholder), dica e erro ligados ao
// input por aria-describedby.
export function TextField({ label, hint, error, className = "", icone, ...input }) {
  const id = useId();
  const dicaId = hint ? `${id}-dica` : undefined;
  const erroId = error ? `${id}-erro` : undefined;

  return (
    <div className={`ui-field ${className}`.trim()}>
      <label htmlFor={id}>{label}</label>
      <div className={icone ? "ui-input-icone" : undefined}>
        {icone && <Icon nome={icone} tamanho={18} />}
        <input
          id={id}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={[dicaId, erroId].filter(Boolean).join(" ") || undefined}
          {...input}
        />
      </div>
      {hint && !error && (
        <small id={dicaId} className="ui-dica">
          {hint}
        </small>
      )}
      {error && (
        <small id={erroId} className="ui-erro-texto" role="alert">
          {error}
        </small>
      )}
    </div>
  );
}

export function PasswordField({ label, hint, error, className = "", ...input }) {
  const id = useId();
  const [visivel, setVisivel] = useState(false);
  const dicaId = hint ? `${id}-dica` : undefined;
  const erroId = error ? `${id}-erro` : undefined;

  return (
    <div className={`ui-field ${className}`.trim()}>
      <label htmlFor={id}>{label}</label>
      <div className="ui-senha">
        <input
          id={id}
          type={visivel ? "text" : "password"}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={[dicaId, erroId].filter(Boolean).join(" ") || undefined}
          {...input}
        />
        <button
          type="button"
          className="ui-btn ui-btn--ghost ui-btn--icon"
          onClick={() => setVisivel((v) => !v)}
          aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visivel}
        >
          <Icon nome={visivel ? "olhoRiscado" : "olho"} />
        </button>
      </div>
      {hint && !error && (
        <small id={dicaId} className="ui-dica">
          {hint}
        </small>
      )}
      {error && (
        <small id={erroId} className="ui-erro-texto" role="alert">
          {error}
        </small>
      )}
    </div>
  );
}

export function TextAreaField({ label, hint, error, className = "", contador, ...input }) {
  const id = useId();
  const dicaId = hint ? `${id}-dica` : undefined;
  const erroId = error ? `${id}-erro` : undefined;

  return (
    <div className={`ui-field ${className}`.trim()}>
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={[dicaId, erroId].filter(Boolean).join(" ") || undefined}
        {...input}
      />
      <div className="ui-campo-rodape">
        {error ? (
          <small id={erroId} className="ui-erro-texto" role="alert">
            {error}
          </small>
        ) : (
          hint && (
            <small id={dicaId} className="ui-dica">
              {hint}
            </small>
          )
        )}
        {contador !== undefined && <small className="ui-dica ui-contador">{contador}</small>}
      </div>
    </div>
  );
}

export function SelectField({ label, hint, className = "", children, ...input }) {
  const id = useId();
  return (
    <div className={`ui-field ${className}`.trim()}>
      <label htmlFor={id}>{label}</label>
      <select id={id} {...input}>
        {children}
      </select>
      {hint && <small className="ui-dica">{hint}</small>}
    </div>
  );
}
