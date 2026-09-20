import { useCallback, useEffect, useMemo, useState } from "react";
import Icon from "./Icon";
import { ToastContext } from "./toastContext";

const DURACAO = { sucesso: 4500, info: 4500, erro: 8000 };
const MAXIMO = 3;

function ItemToast({ toast, aoFechar }) {
  useEffect(() => {
    const tempo = setTimeout(() => aoFechar(toast.id), toast.duracao);
    return () => clearTimeout(tempo);
  }, [toast.id, toast.duracao, aoFechar]);

  return (
    <div
      className={`ui-toast ui-toast--${toast.tipo}`}
      role={toast.tipo === "erro" ? "alert" : "status"}
    >
      <Icon nome={toast.tipo === "erro" ? "alertaCirculo" : toast.tipo === "info" ? "info" : "checkCirculo"} />
      <p>{toast.texto}</p>
      <button
        type="button"
        className="ui-toast-fechar"
        onClick={() => aoFechar(toast.id)}
        aria-label="Dispensar aviso"
      >
        <Icon nome="fechar" tamanho={18} />
      </button>
    </div>
  );
}

// Mensagens passageiras no topo da tela. Substitui os alert() do navegador:
// aparecem sem travar a página e o leitor de tela as anuncia.
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const fechar = useCallback((id) => {
    setToasts((atuais) => atuais.filter((t) => t.id !== id));
  }, []);

  const mostrar = useCallback((tipo, texto, duracao) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((atuais) =>
      [...atuais, { id, tipo, texto, duracao: duracao ?? DURACAO[tipo] }].slice(-MAXIMO)
    );
  }, []);

  const api = useMemo(
    () => ({
      sucesso: (texto, duracao) => mostrar("sucesso", texto, duracao),
      erro: (texto, duracao) => mostrar("erro", texto, duracao),
      info: (texto, duracao) => mostrar("info", texto, duracao),
    }),
    [mostrar]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="ui-toasts" aria-live="polite">
        {toasts.map((t) => (
          <ItemToast key={t.id} toast={t} aoFechar={fechar} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
