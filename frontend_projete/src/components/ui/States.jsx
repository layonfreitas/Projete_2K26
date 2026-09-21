import Icon from "./Icon";
import Button from "./Button";

export function Skeleton({ linhas = 3, altura = 64, className = "" }) {
  return (
    <div className={`ui-esqueleto ${className}`.trim()} aria-hidden="true">
      {Array.from({ length: linhas }, (_, i) => (
        <span key={i} style={{ height: altura }} />
      ))}
    </div>
  );
}

export function Spinner({ rotulo = "Carregando…" }) {
  return (
    <div className="ui-carregando" role="status">
      <span className="ui-spinner ui-spinner--grande" aria-hidden="true" />
      <span>{rotulo}</span>
    </div>
  );
}

export function EmptyState({ icone = "broto", titulo, texto, children, className = "" }) {
  return (
    <div className={`ui-vazio ${className}`.trim()}>
      <span className="ui-vazio-icone" aria-hidden="true">
        <Icon nome={icone} tamanho={26} />
      </span>
      <strong>{titulo}</strong>
      {texto && <p>{texto}</p>}
      {children && <div className="ui-vazio-acoes">{children}</div>}
    </div>
  );
}

export function ErrorState({ titulo = "Não foi possível carregar", mensagem, aoTentar }) {
  return (
    <div className="ui-falha" role="alert">
      <Icon nome="alertaCirculo" tamanho={22} />
      <div>
        <strong>{titulo}</strong>
        {mensagem && <p>{mensagem}</p>}
      </div>
      {aoTentar && (
        <Button variant="secondary" size="sm" icon="atualizar" onClick={aoTentar}>
          Tentar de novo
        </Button>
      )}
    </div>
  );
}

// Aviso dentro da página (não some sozinho). Para mensagens passageiras,
// use o toast (useToast).
export function Notice({ tipo = "info", children, className = "" }) {
  const icone =
    tipo === "sucesso" ? "checkCirculo" : tipo === "erro" || tipo === "aviso" ? "alertaCirculo" : "info";
  return (
    <div
      className={`ui-aviso ui-aviso--${tipo} ${className}`.trim()}
      role={tipo === "erro" ? "alert" : "status"}
    >
      <Icon nome={icone} tamanho={18} />
      <span>{children}</span>
    </div>
  );
}

export function Badge({ tom = "neutro", children }) {
  return <span className={`ui-selo ui-selo--${tom}`}>{children}</span>;
}
