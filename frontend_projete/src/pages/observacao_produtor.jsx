import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { AUTH_API_URL } from "../config/api";
import AppBar from "../components/ui/AppBar";
import Icon from "../components/ui/Icon";
import { EmptyState, ErrorState, Skeleton } from "../components/ui/States";
import { mensagemDeErro } from "../services/erros";
import { contar } from "../utils/texto";
import "./observacao_produtor.css";

export default function Observacoes() {
  const { id } = useParams();
  const lavouraNome = localStorage.getItem("lavouraNome");

  const [tentativa, setTentativa] = useState(0);
  const [consulta, setConsulta] = useState({ chave: "", observacoes: [], erro: "" });

  const chave = `${id}:${tentativa}`;

  useEffect(() => {
    let cancelado = false;

    async function carregarObservacoes() {
      try {
        const resposta = await fetch(`${AUTH_API_URL}/observacoes/${id}`);
        const dados = await resposta.json();

        if (!resposta.ok) {
          throw new Error(dados.erro || "Erro ao buscar observações.");
        }

        if (!cancelado) setConsulta({ chave, observacoes: dados, erro: "" });
      } catch (erro) {
        if (!cancelado) {
          setConsulta({
            chave,
            observacoes: [],
            erro: mensagemDeErro(erro, "Erro ao buscar observações."),
          });
        }
      }
    }

    carregarObservacoes();

    return () => {
      cancelado = true;
    };
  }, [id, chave]);

  const carregando = consulta.chave !== chave;
  // as mais recentes primeiro
  const observacoes = consulta.chave === chave ? [...consulta.observacoes].sort((a, b) => b.id - a.id) : [];
  const erro = consulta.chave === chave ? consulta.erro : "";

  return (
    <div className="ui-coluna ui-coluna--sem-nav">
      <AppBar
        titulo="Observações"
        subtitulo={lavouraNome || "Registradas para esta lavoura"}
        para="/home"
      />

      <main className="ui-conteudo">
        {carregando && (
          <div aria-busy="true">
            <Skeleton linhas={3} altura={96} />
          </div>
        )}

        {!carregando && erro && (
          <ErrorState mensagem={erro} aoTentar={() => setTentativa((n) => n + 1)} />
        )}

        {!carregando && !erro && observacoes.length === 0 && (
          <EmptyState
            icone="mensagem"
            titulo="Nenhuma observação ainda"
            texto="Quando o seu agrônomo registrar observações sobre esta lavoura, elas aparecem aqui."
          />
        )}

        {observacoes.length > 0 && (
          <>
            <p className="obsl-resumo">{contar(observacoes.length, "observação", "observações")}</p>

            <ul className="obsl-lista">
              {observacoes.map((observacao) => (
                <li className="obsl-item" key={observacao.id}>
                  <span className="obsl-icone" aria-hidden="true">
                    <Icon nome="mensagem" tamanho={18} />
                  </span>
                  <p>{observacao.texto}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
