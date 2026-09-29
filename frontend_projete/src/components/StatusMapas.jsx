import { useEffect, useRef, useState } from "react";
import { AUTH_API_URL } from "../config/api";
import { fetchAutenticado } from "../services/apiAutenticado";
import { Notice } from "./ui/States";

const ativos = new Set(["na_fila", "processando"]);

export default function StatusMapas({
  lavouraId,
  versao = 0,
  aoConcluir,
}) {
  const [consulta, setConsulta] = useState(null);

  const callback = useRef(aoConcluir);
  const ultimaConclusao = useRef(null);

  callback.current = aoConcluir;

  useEffect(() => {
    if (!lavouraId) return;

    let timer;

    const controller = new AbortController();

    setConsulta(null);

    async function atualizar() {
      let continuar = true;

      try {
        const resposta = await fetchAutenticado(
          `${AUTH_API_URL}/lavoura/${lavouraId}/mapas-status`,
          {
            signal: controller.signal,
          }
        );

        if (!resposta.ok) {
          throw new Error("Consulta indisponível");
        }

        const dados = await resposta.json();

        if (controller.signal.aborted) return;

        setConsulta({
          ...dados,
          lavouraId,
        });

        continuar = ativos.has(dados.status);

        if (
          !continuar &&
          dados.tarefa_id &&
          ultimaConclusao.current !== dados.tarefa_id
        ) {
          ultimaConclusao.current = dados.tarefa_id;
          callback.current?.();
        }
      } catch {
        if (controller.signal.aborted) return;

        setConsulta({
          lavouraId,
          status: "consulta_indisponivel",
          mensagem:
            "Não foi possível consultar o andamento agora. " +
            "Tentaremos novamente. Sua lavoura continua cadastrada.",
        });
      }

      if (continuar && !controller.signal.aborted) {
        timer = setTimeout(atualizar, 15000);
      }
    }

    atualizar();

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [lavouraId, versao]);

  if (
    !consulta ||
    consulta.lavouraId !== lavouraId ||
    consulta.status === "sem_solicitacao"
  ) {
    return null;
  }

  const tipo =
    consulta.status === "concluido"
      ? "sucesso"
      : ativos.has(consulta.status)
        ? "info"
        : "aviso";

  return (
    <Notice tipo={tipo}>
      {consulta.mensagem}
    </Notice>
  );
}