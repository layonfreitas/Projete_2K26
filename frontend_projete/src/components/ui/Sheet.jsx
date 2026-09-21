import { useEffect, useId, useRef } from "react";
import Icon from "./Icon";

// Painel deslizante (bottom sheet no celular, janela no desktop) feito com
// <dialog>: o navegador cuida de foco preso, ESC e leitor de tela.
// Coloque data-foco no elemento que deve receber o foco ao abrir.
export default function Sheet({
  aberto,
  aoFechar,
  titulo,
  descricao,
  children,
  fecharAoClicarFora = true,
}) {
  const ref = useRef(null);
  const pressionouFora = useRef(false);
  const tituloId = useId();

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (aberto) {
      if (!dialogo.open) dialogo.showModal();
      const alvo = dialogo.querySelector("[data-foco]") || dialogo.querySelector("input, button");
      alvo?.focus();
    } else if (dialogo.open) {
      dialogo.close();
    }
  }, [aberto]);

  return (
    <dialog
      ref={ref}
      className="ui-painel"
      aria-labelledby={tituloId}
      onClose={aoFechar}
      onMouseDown={(e) => {
        pressionouFora.current = e.target === ref.current;
      }}
      onClick={(e) => {
        if (fecharAoClicarFora && e.target === ref.current && pressionouFora.current) aoFechar();
      }}
    >
      {aberto && (
        <div className="ui-painel-corpo">
          <div className="ui-painel-topo">
            <div>
              <h2 id={tituloId}>{titulo}</h2>
              {descricao && <p>{descricao}</p>}
            </div>
            <button
              type="button"
              className="ui-btn ui-btn--ghost ui-btn--icon"
              onClick={aoFechar}
              aria-label="Fechar"
            >
              <Icon nome="fechar" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
