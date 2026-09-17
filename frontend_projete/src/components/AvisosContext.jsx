import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import { AUTH_API_URL } from "../config/api";
import { fetchAutenticado } from "../services/apiAutenticado";

const Contexto = createContext(null);

export function AvisosProvider({ children }) {
  // Reavalia a conta quando há navegação, incluindo login/logout.
  useLocation();

  const usuarioId = localStorage.getItem("usuarioId");
  const tipo = localStorage.getItem("usuarioTipo");

  const ativo =
    !!usuarioId &&
    ["produtor", "agronomo"].includes(tipo) &&
    localStorage.getItem("autenticado") === "true";

  const chave = ativo ? `${usuarioId}:${tipo}` : "";

  const identidade = useRef(chave);
  identidade.current = chave;

  const versao = useRef(0);
  const bloqueado = useRef(false);

  const [estado, setEstado] = useState({
    chave: "",
    avisos: [],
  });

  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Evita mostrar os avisos de outra conta durante uma troca.
  const avisos = estado.chave === chave ? estado.avisos : [];

  useEffect(() => {
    setErro("");

    if (!chave) return;

    let cancelado = false;
    let buscando = false;

    const controller = new AbortController();

    async function buscar() {
      if (buscando || document.hidden || bloqueado.current) {
        return;
      }

      buscando = true;
      const inicio = versao.current;

      try {
        const resposta = await fetchAutenticado(
          `${AUTH_API_URL}/avisos`,
          { signal: controller.signal }
        );

        const dados = await resposta.json();

        if (!resposta.ok) {
          throw new Error(
            dados.mensagem || "Erro ao carregar avisos."
          );
        }

        // Uma consulta antiga não deve desfazer uma leitura recente.
        if (
          !cancelado &&
          inicio === versao.current &&
          !bloqueado.current
        ) {
          setEstado({ chave, avisos: dados });
          setErro("");
        }
      } catch (e) {
        if (!cancelado && e.name !== "AbortError") {
          setErro(e.message);
        }
      } finally {
        buscando = false;
      }
    }

    buscar();

    const timer = setInterval(buscar, 45000);

    window.addEventListener("focus", buscar);
    document.addEventListener("visibilitychange", buscar);

    return () => {
      cancelado = true;
      controller.abort();
      clearInterval(timer);

      window.removeEventListener("focus", buscar);
      document.removeEventListener("visibilitychange", buscar);
    };
  }, [chave]);

  async function salvar(ids, todos = false) {
    if (!chave || bloqueado.current || !ids.length) {
      return;
    }

    bloqueado.current = true;
    versao.current += 1;

    setSalvando(true);
    setErro("");

    try {
      for (let i = 0; i < ids.length; i += 1000) {
        if (identidade.current !== chave) return;

        const lote = ids.slice(i, i + 1000);
        const caminho = todos
          ? "ler-todos"
          : `${lote[0]}/ler`;

        const resposta = await fetchAutenticado(
          `${AUTH_API_URL}/avisos/${caminho}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ids: lote }),
          }
        );

        const dados = await resposta.json();

        if (!resposta.ok) {
          throw new Error(
            dados.mensagem || "Erro ao salvar leitura."
          );
        }

        // Só altera a tela depois da confirmação do servidor.
        if (identidade.current === chave) {
          setEstado((atual) => {
            if (atual.chave !== chave) return atual;

            return {
              ...atual,
              avisos: atual.avisos.map((aviso) =>
                lote.includes(aviso.id)
                  ? { ...aviso, lido: true }
                  : aviso
              ),
            };
          });
        }
      }
    } catch (e) {
      if (identidade.current === chave) {
        setErro(e.message);
      }
    } finally {
      versao.current += 1;
      bloqueado.current = false;
      setSalvando(false);
    }
  }

  return (
    <Contexto.Provider
      value={{
        avisos,
        ativo,
        erro,
        salvando,
        marcarComoLido: (id) => salvar([id]),
        marcarTodosComoLidos: () =>
          salvar(
            avisos
              .filter((aviso) => !aviso.lido)
              .map((aviso) => aviso.id),
            true
          ),
      }}
    >
      {children}
    </Contexto.Provider>
  );
}

export function useAvisos() {
  return useContext(Contexto);
}