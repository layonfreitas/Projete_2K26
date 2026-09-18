export function Icon({ name = "leaf", ...props }) {
  const paths = {
    leaf: "M20 4C9 2 3 8 6 15s15 4 14-11ZM6 18l9-9M4 20l2-2",
    users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    plus: "M12 5v14M5 12h14",
    alert: "m12 3 10 18H2L12 3ZM12 9v4M12 17h.01",
    link: "m10 13 4-4M8 16l-2 2a4 4 0 0 1-6-6l4-4M16 8l2-2a4 4 0 0 1 6 6l-4 4",
    download: "M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4",
    bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
    grid: "M3 3h7v7H3V3ZM14 3h7v7h-7V3ZM3 14h7v7H3v-7ZM14 14h7v7h-7v-7Z",
    arrow: "M5 12h14m-5-5 5 5-5 5",
    refresh: "M20 7a9 9 0 1 0 1 8M20 2v5h-5",
    check: "m5 12 4 4L19 6",
  };
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name] || paths.leaf} /></svg>;
}
export function Panel({ id, title, description, aside, children }) {
  return <section className="coop-panel" id={id} aria-labelledby={`${id}-title`}><div className="coop-panel-heading"><div><h2 id={`${id}-title`}>{title}</h2>{description && <p>{description}</p>}</div>{aside}</div>{children}</section>;
}
export function ResourceState({ resource, retry, children, empty, emptyText }) {
  if (resource.carregando && !resource.dados) return <div className="coop-empty" role="status"><span className="coop-spinner" />Carregando informações…</div>;
  if (resource.erro) return <div className="coop-feedback error" role="alert"><p>{resource.erro}</p><button type="button" className="coop-btn secondary" onClick={retry}>Tentar novamente</button></div>;
  if (empty) return <div className="coop-empty"><Icon name="leaf" /><p>{emptyText}</p></div>;
  return <div aria-busy={resource.carregando}>{children}</div>;
}
export function Field({ label, children }) {
  return <label className="coop-field"><span>{label}</span>{children}</label>;
}
export function Pagination({ page, pages, total, onChange }) {
  return <nav className="coop-pagination" aria-label="Paginação"><span>{total} registro{total !== 1 ? "s" : ""}</span><div><button className="coop-btn secondary" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Página anterior">Anterior</button><span aria-live="polite">{page} / {pages}</span><button className="coop-btn secondary" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Próxima página">Próxima</button></div></nav>;
}
