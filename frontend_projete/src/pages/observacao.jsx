import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import { AUTH_API_URL } from "../config/api";
import AppBar from "../components/ui/AppBar";
import Button from "../components/ui/Button";
import { TextAreaField } from "../components/ui/Field";
import { useToast } from "../components/ui/toastContext";
import { mensagemDeErro } from "../services/erros";

export default function Observacao() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const lavouraNome = localStorage.getItem("lavouraNome");
  const produtorNome = localStorage.getItem("produtorSelecionadoNome");

  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvarObservacao(evento) {
    evento.preventDefault();

    if (!texto.trim()) {
      setErro("Digite uma observação antes de salvar.");
      return;
    }

    setErro("");
    setSalvando(true);

    try {
      const resposta = await fetch(`${AUTH_API_URL}/observacoes`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          lavoura_id: id,
          texto: texto,
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(dados.erro || "Erro ao salvar observação.");
      }

      toast.sucesso("Observação salva com sucesso!");

      setTexto("");
    } catch (error) {
      toast.erro(mensagemDeErro(error, "Erro ao salvar observação. Tente novamente."));
    } finally {
      setSalvando(false);
    }
  }

  const contexto = [lavouraNome, produtorNome].filter(Boolean).join(" — ");

  return (
    <div className="ui-coluna ui-coluna--sem-nav">
      <AppBar titulo="Nova observação" subtitulo={contexto || undefined} para="/home" />

      <form className="ui-conteudo" onSubmit={salvarObservacao} noValidate>
        <div className="ui-cartao">
          <TextAreaField
            label="O que você observou na lavoura?"
            placeholder="Digite sua observação…"
            hint="O produtor poderá ler esta observação."
            error={erro}
            contador={`${texto.length} caracteres`}
            rows={8}
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              if (erro) setErro("");
            }}
          />
        </div>

        <div className="ui-acoes-pagina">
          <Button type="submit" size="lg" block icon="check" loading={salvando}>
            {salvando ? "Salvando…" : "Salvar observação"}
          </Button>
          <Button
            variant="secondary"
            block
            icon="mensagem"
            onClick={() => navigate(`/observacao_produtor/${id}`)}
          >
            Ver observações anteriores
          </Button>
        </div>
      </form>
    </div>
  );
}
