import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AUTH_API_URL } from "../config/api";
import BottomNav from "../components/BottomNav";
import AppBar from "../components/ui/AppBar";
import Avatar from "../components/ui/Avatar";
import Icon from "../components/ui/Icon";
import { TextField } from "../components/ui/Field";
import { Badge, EmptyState, ErrorState, Skeleton } from "../components/ui/States";
import { mensagemDeErro } from "../services/erros";
import { contar, normalizar } from "../utils/texto";
import "./agronomo.css";

function Agronomo() {
  const navigate = useNavigate();

  const agronomoId = localStorage.getItem("usuarioId");
  const selecionadoId = localStorage.getItem("produtorSelecionadoId");

  const [tentativa, setTentativa] = useState(0);
  const [consulta, setConsulta] = useState({ chave: "", produtores: [], erro: "" });
  const [busca, setBusca] = useState("");

  const chave = agronomoId ? `${agronomoId}:${tentativa}` : "";

  useEffect(() => {
    if (!chave) return undefined;

    let cancelado = false;

    async function buscarProdutores() {
      try {
        const resposta = await fetch(`${AUTH_API_URL}/agronomo/${agronomoId}/produtores`);
        const dados = await resposta.json();

        if (!resposta.ok) {
          throw new Error(dados.mensagem || "Erro ao buscar produtores.");
        }

        if (!cancelado) setConsulta({ chave, produtores: dados, erro: "" });
      } catch (erro) {
        if (!cancelado) {
          setConsulta({
            chave,
            produtores: [],
            erro: mensagemDeErro(erro, "Erro ao buscar produtores."),
          });
        }
      }
    }

    buscarProdutores();

    return () => {
      cancelado = true;
    };
  }, [chave, agronomoId]);

  const carregando = Boolean(chave) && consulta.chave !== chave;
  const produtores = consulta.chave === chave ? consulta.produtores : [];
  const erro = !agronomoId
    ? "Usuário não identificado."
    : consulta.chave === chave
      ? consulta.erro
      : "";

  const termo = normalizar(busca.trim());
  const filtrados = termo
    ? produtores.filter((p) => normalizar(`${p.nome} ${p.email}`).includes(termo))
    : produtores;

  function selecionarProdutor(produtor) {
    localStorage.setItem("produtorSelecionadoId", produtor.id);
    localStorage.setItem("produtorSelecionadoNome", produtor.nome);
    // a lavoura em foco era do produtor anterior
    localStorage.removeItem("lavouraId");
    localStorage.removeItem("lavouraNome");

    navigate("/home");
  }

  return (
    <div className="ui-coluna">
      <AppBar
        titulo="Meus produtores"
        subtitulo="Escolha quem você vai acompanhar."
        semVoltar
      />

      <main className="ui-conteudo">
        {carregando && (
          <div aria-busy="true">
            <Skeleton linhas={4} altura={76} />
          </div>
        )}

        {!carregando && erro && (
          <ErrorState
            mensagem={erro}
            aoTentar={agronomoId ? () => setTentativa((n) => n + 1) : undefined}
          />
        )}

        {!carregando && !erro && produtores.length === 0 && (
          <EmptyState
            icone="usuarios"
            titulo="Nenhum produtor por aqui ainda"
            texto="Quando a cooperativa vincular produtores a você, eles aparecem nesta lista."
          />
        )}

        {produtores.length > 5 && (
          <TextField
            label="Buscar produtor"
            type="search"
            icone="busca"
            placeholder="Nome ou e-mail"
            autoComplete="off"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        )}

        {produtores.length > 0 && (
          <p className="agro-resumo" aria-live="polite">
            {contar(filtrados.length, "produtor", "produtores")}
          </p>
        )}

        <ul className="agro-lista">
          {filtrados.map((produtor) => {
            const ativo = String(produtor.id) === String(selecionadoId);
            return (
              <li key={produtor.id}>
                <button
                  type="button"
                  className={`agro-cartao ${ativo ? "agro-cartao-ativo" : ""}`}
                  onClick={() => selecionarProdutor(produtor)}
                  aria-current={ativo ? "true" : undefined}
                >
                  <Avatar nome={produtor.nome} tamanho={46} />
                  <span className="agro-info">
                    <span className="agro-nome">{produtor.nome}</span>
                    <span className="agro-email">{produtor.email}</span>
                  </span>
                  {ativo ? (
                    <Badge tom="ok">
                      <Icon nome="check" tamanho={13} espessura={2.4} />
                      Selecionado
                    </Badge>
                  ) : (
                    <Icon nome="setaDireita" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {produtores.length > 0 && filtrados.length === 0 && (
          <EmptyState
            icone="busca"
            titulo="Ninguém encontrado"
            texto="Tente outro nome ou e-mail."
          />
        )}
      </main>

      <BottomNav />
    </div>
  );
}

export default Agronomo;
