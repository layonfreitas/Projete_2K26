import { createContext, useContext } from "react";

export const ToastContext = createContext(null);

// const toast = useToast();  toast.sucesso("Salvo!");  toast.erro("Falhou");
export function useToast() {
  const contexto = useContext(ToastContext);
  if (!contexto) {
    throw new Error("useToast precisa estar dentro de <ToastProvider>.");
  }
  return contexto;
}
