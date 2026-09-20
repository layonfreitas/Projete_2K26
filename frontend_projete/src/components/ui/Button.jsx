import Icon from "./Icon";

// Botão padrão do app. Todas as variações usam as mesmas cores do tema
// (ver ui.css). `loading` mostra um spinner e bloqueia cliques repetidos.
export default function Button({
  variant = "primary",
  size = "md",
  block = false,
  loading = false,
  icon,
  className = "",
  type = "button",
  disabled,
  children,
  ...resto
}) {
  const classes = [
    "ui-btn",
    variant !== "primary" && `ui-btn--${variant}`,
    size !== "md" && `ui-btn--${size}`,
    block && "ui-btn--block",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...resto}
    >
      {loading ? (
        <span className="ui-spinner" aria-hidden="true" />
      ) : (
        icon && <Icon nome={icon} tamanho={size === "sm" ? 16 : 18} />
      )}
      {children}
    </button>
  );
}
