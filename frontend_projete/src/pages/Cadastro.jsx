import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { AUTH_API_URL } from "../config/api";
import AppBar from "../components/ui/AppBar";
import Button from "../components/ui/Button";
import { TextField } from "../components/ui/Field";
import { EmptyState, Notice } from "../components/ui/States";
import { useToast } from "../components/ui/toastContext";
import { calcularAreaHectares, formatarHectares, pontosParaSvg } from "../utils/geo";
import { mensagemDeErro } from "../services/erros";
import "./Cadastro.css";

export default function Cadastro() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const coordenadas = location.state?.coordenadas;

  const [nome, setNome] = useState("");
  const [erroNome, setErroNome] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(false);

  const [safras, setSafras] = useState([
  { ano: "", inicio: "", fim: "" },
]);

const hoje = new Date();
const anoAtual = hoje.getFullYear();

const hojeTexto = [
  anoAtual,
  String(hoje.getMonth() + 1).padStart(2, "0"),
  String(hoje.getDate()).padStart(2, "0"),
].join("-");

function alterarSafra(indice, campo, valor) {
  setSafras((anteriores) =>
    anteriores.map((safra, posicao) =>
      posicao === indice
        ? { ...safra, [campo]: valor }
        : safra
    )
  );
}

function adicionarSafra() {
  setSafras((anteriores) => [
    ...anteriores,
    { ano: "", inicio: "", fim: "" },
  ]);
}

function removerSafra(indice) {
  setSafras((anteriores) =>
    anteriores.filter((_, posicao) => posicao !== indice)
  );
}

  const temPoligono = Array.isArray(coordenadas) && coordenadas.length >= 3;
  const area_hectares = calcularAreaHectares(coordenadas);

 async function salvarCadastro(evento) {
  evento.preventDefault();

  if (carregando) return;

  setMensagem("");
  setErroNome("");

  const usuarioId = localStorage.getItem("usuarioId");

  if (!usuarioId) {
    setMensagem("Entre na sua conta antes de cadastrar.");
    return;
  }

  if (!nome.trim()) {
    setErroNome("Dê um nome para identificar a lavoura.");
    return;
  }

  if (!temPoligono) {
    setMensagem("Desenhe o contorno da lavoura primeiro.");
    return;
  }

  const periodos = safras
    .map((safra) => ({
      ano: Number(safra.ano),
      inicio: safra.inicio,
      fim: safra.fim,
    }))
    .sort((a, b) => a.inicio.localeCompare(b.inicio));

  const temCampoInvalido = periodos.some(
    (safra) =>
      !Number.isInteger(safra.ano) ||
      safra.ano < 2017 ||
      safra.ano > anoAtual ||
      !safra.inicio ||
      !safra.fim ||
      safra.inicio < "2017-03-28" ||
      safra.fim > hojeTexto ||
      safra.inicio > safra.fim
  );

  if (!periodos.length || temCampoInvalido) {
    setMensagem(
      "Preencha o ano, o início e o fim de todas as safras. " +
      "Use períodos entre 28/03/2017 e hoje."
    );
    return;
  }

  if (new Set(periodos.map((safra) => safra.ano)).size !== periodos.length) {
    setMensagem("Informe cada ano de safra apenas uma vez.");
    return;
  }

  const temSobreposicao = periodos.some(
    (safra, indice) =>
      indice > 0 &&
      safra.inicio <= periodos[indice - 1].fim
  );

  if (temSobreposicao) {
    setMensagem("Os períodos das safras não podem se sobrepor.");
    return;
  }

  setCarregando(true);

  try {
    const resposta = await fetch(`${AUTH_API_URL}/lavoura`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Usuario-Id": usuarioId,
      },
      body: JSON.stringify({
        usuarioId,
        nomeLavoura: nome.trim(),
        coordenadas,
        safras: periodos,
      }),
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      setMensagem(dados.mensagem || "Erro ao cadastrar lavoura.");
      return;
    }

    toast.sucesso("Lavoura cadastrada com sucesso!");

    if (dados.mapas?.status === "aceito") {
      toast.info(
        "Processamento solicitado. As séries das safras e os mapas " +
        "serão gerados em segundo plano."
      );
    } else {
      toast.erro(
        "A lavoura foi salva, mas o processamento não foi confirmado. " +
        "Use Gerar imagens no histórico para tentar novamente."
      );
    }

    navigate("/home");
  } catch (erro) {
    setMensagem(
      mensagemDeErro(
        erro,
        "Não foi possível confirmar o cadastro. Confira suas lavouras antes de tentar novamente."
      )
    );
  } finally {
    setCarregando(false);
  }
}




  if (!temPoligono) {
    return (
      <div className="ui-coluna ui-coluna--sem-nav">
        <AppBar titulo="Cadastro da lavoura" para="/mapa" />
        <div className="ui-conteudo">
          <EmptyState
            icone="mapa"
            titulo="Nenhum contorno recebido"
            texto="Para cadastrar uma lavoura, marque os pontos dela no mapa e confirme o contorno."
          >
            <Button icon="mapa" onClick={() => navigate("/mapa")}>
              Ir para o mapa
            </Button>
          </EmptyState>
        </div>
      </div>
    );
  }

  return (
    <div className="ui-coluna ui-coluna--sem-nav">
      <AppBar
        titulo="Cadastro da lavoura"
        subtitulo="Dê um nome para a área que você marcou."
        para="/mapa"
      />

      <form className="ui-conteudo" onSubmit={salvarCadastro} noValidate>
        <div className="ui-cartao ui-formulario">
          <div className="cad-resumo">
            <svg
              className="cad-contorno"
              viewBox="0 0 240 160"
              role="img"
              aria-label="Desenho do contorno da lavoura"
            >
              <polygon points={pontosParaSvg(coordenadas)} />
            </svg>

            <dl className="cad-numeros">
              <div>
                <dt>Área</dt>
                <dd>{formatarHectares(area_hectares)}</dd>
              </div>
              <div>
                <dt>Pontos marcados</dt>
                <dd>{coordenadas.length}</dd>
              </div>
            </dl>
          </div>

          <TextField
            label="Nome da lavoura"
            placeholder="Ex.: Lavoura Boa Vista"
            autoComplete="off"
            error={erroNome}
            value={nome}
            onChange={(e) => {
              setNome(e.target.value);
              if (erroNome) setErroNome("");
            }}
          />

          <section className="cad-safras" aria-labelledby="titulo-safras">
  <div>
    <h2 id="titulo-safras">Safras da lavoura</h2>

    <p>
      Informe todos os períodos que deseja analisar.
      O ano identifica a safra pela colheita.
    </p>

    <small>
      Imagens disponíveis a partir de 28/03/2017.
      A disponibilidade varia conforme a região e as nuvens.
    </small>
  </div>

  {safras.map((safra, indice) => (
    <fieldset
      className="cad-safra"
      key={indice}
      disabled={carregando}
    >
      <legend>Safra {indice + 1}</legend>

      <div className="cad-safra-campos">
        <TextField
          label="Ano da safra / colheita"
          type="number"
          min="2017"
          max={anoAtual}
          step="1"
          placeholder="Ex.: 2025"
          value={safra.ano}
          onChange={(evento) =>
            alterarSafra(indice, "ano", evento.target.value)
          }
          required
        />

        <TextField
          label="Início do período"
          type="date"
          min="2017-03-28"
          max={safra.fim || hojeTexto}
          value={safra.inicio}
          onChange={(evento) =>
            alterarSafra(indice, "inicio", evento.target.value)
          }
          required
        />

        <TextField
          label="Fim do período"
          type="date"
          min={safra.inicio || "2017-03-28"}
          max={hojeTexto}
          value={safra.fim}
          onChange={(evento) =>
            alterarSafra(indice, "fim", evento.target.value)
          }
          required
        />
      </div>

      <Button
        type="button"
        variant="secondary"
        disabled={safras.length === 1 || carregando}
        onClick={() => removerSafra(indice)}
      >
        Remover safra
      </Button>
    </fieldset>
  ))}

  <Button
    type="button"
    variant="secondary"
    disabled={carregando || safras.length >= 30}
    onClick={adicionarSafra}
  >
    Adicionar outra safra
  </Button>
</section>

          {mensagem && <Notice tipo="erro">{mensagem}</Notice>}
        </div>

        <div className="ui-acoes-pagina">
          <Button type="submit" size="lg" block loading={carregando}>
            {carregando ? "Salvando…" : "Salvar cadastro"}
          </Button>
          <Button variant="secondary" block onClick={() => navigate("/mapa")}>
            Voltar ao mapa
          </Button>
        </div>
      </form>
    </div>
  );
}