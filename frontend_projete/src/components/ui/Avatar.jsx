import { iniciais } from "../../utils/texto";

export default function Avatar({ nome, tamanho = 44, tom = "canopy", className = "" }) {
  return (
    <span
      className={`ui-avatar ui-avatar--${tom} ${className}`.trim()}
      style={{ width: tamanho, height: tamanho, fontSize: Math.round(tamanho * 0.34) }}
      aria-hidden="true"
    >
      {iniciais(nome, "?")}
    </span>
  );
}
