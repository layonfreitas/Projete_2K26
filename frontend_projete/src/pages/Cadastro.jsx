import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { AUTH_API_URL, IA_API_URL } from "../config/api";
import AppBar from "../components/ui/AppBar";
import Button from "../components/ui/Button";
import { TextField } from "../components/ui/Field";
import { EmptyState, Notice } from "../components/ui/States";
import { useToast } from "../components/ui/toastContext";
import { calcularAreaHectares, formatarHectares, pontosParaSvg } from "../utils/geo";
import { mensagemDeErro } from "../services/erros";
import "./Cadastro.css";

const DATA_MINIMA = "2017-03-28";

// Converte uma Date para "AAAA-MM-DD" usando a data local do usuário.
function formatarData(data) {
  return [
    data.getFullYear(),
    String(data.getMonth() + 1).padStart(2, "0"),
    String(data.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatarDataBR(texto) {
  const [ano, mes, dia] = texto.split("-");
  return `${dia}/${mes}/${ano}`;
}

export default function Cadastro() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const coordenadas = location.state?.coordenadas;

  const [nome, setNome] = useState("");
  const [erroNome, setErroNome] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(false);

  // SAFRA ATUAL (especial): o usuário informa apenas o início.
  // O fim é sempre o dia em que a lavoura é cadastrada.
  const [inicioSafraAtual, setInicioSafraAtual] = useState("");

  // Safras anteriores (histórico). Podem ser zero.
  const [safras, setSafras] = useState([]);

  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const hojeTexto = formatarData(hoje);

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

    if (!coordenadas || !temPoligono) {
      setMensagem("Desenhe o contorno da lavoura primeiro.");
      return;
    }

    // Data recalculada no momento do envio: é o "dia do cadastro".
    const dataCadastro = formatarData(new Date());
    const anoCadastro = Number(dataCadastro.slice(0, 4));

    // ---- Safra atual (especial) ----
    // Fim = dia do cadastro. O ano da safra é o ano do cadastro.
    const safraAtual = {
      ano: anoCadastro,
      inicio: inicioSafraAtual,
      fim: dataCadastro,
      atual: true,
    };

    if (
      !safraAtual.inicio ||
      safraAtual.inicio < DATA_MINIMA ||
      safraAtual.inicio > safraAtual.fim
    ) {
      setMensagem(
        "Informe o início da safra atual, entre 28/03/2017 e hoje."
      );
      return;
    }

    // ---- Safras anteriores ----
    const periodosAnteriores = safras.map((safra) => ({
      ano: Number(safra.ano),
      inicio: safra.inicio,
      fim: safra.fim,
      atual: false,
    }));

    const temCampoInvalido = periodosAnteriores.some(
      (safra) =>
        !Number.isInteger(safra.ano) ||
        safra.ano < 2017 ||
        safra.ano > anoCadastro ||
        !safra.inicio ||
        !safra.fim ||
        safra.inicio < DATA_MINIMA ||
        safra.fim > dataCadastro ||
        safra.inicio > safra.fim
    );

    if (temCampoInvalido) {
      setMensagem(
        "Preencha o ano, o início e o fim de todas as safras anteriores. " +
        "Use períodos entre 28/03/2017 e hoje."
      );
      return;
    }

    // Todas as safras juntas (anteriores + atual), ordenadas pelo início.
    const periodos = [...periodosAnteriores, safraAtual].sort((a, b) =>
      a.inicio.localeCompare(b.inicio)
    );

    const rotulo = (safra) =>
      safra.atual ? "a safra atual" : `a safra ${safra.ano}`;

    // Ano da safra (colheita) não pode se repetir.
    if (new Set(periodos.map((safra) => safra.ano)).size !== periodos.length) {
      setMensagem(
        "Informe cada ano de safra apenas uma vez " +
        "(a safra atual usa o ano de hoje)."
      );
      return;
    }

    // Nenhum ano de início repetido: não pode haver duas safras que
    // começam em 2024, por exemplo.
    const anosInicio = periodos.map((safra) => safra.inicio.slice(0, 4));
    const anoInicioRepetido = anosInicio.find(
      (ano, indice) => anosInicio.indexOf(ano) !== indice
    );

    if (anoInicioRepetido) {
      setMensagem(
        `Mais de uma safra começa em ${anoInicioRepetido}. ` +
        "Cada safra deve começar em um ano diferente."
      );
      return;
    }

    // Nenhum ano de fim repetido: não pode haver duas safras que
    // terminam em 2025, por exemplo.
    const anosFim = periodos.map((safra) => safra.fim.slice(0, 4));
    const anoFimRepetido = anosFim.find(
      (ano, indice) => anosFim.indexOf(ano) !== indice
    );

    if (anoFimRepetido) {
      setMensagem(
        `Mais de uma safra termina em ${anoFimRepetido}. ` +
        "Cada safra deve terminar em um ano diferente."
      );
      return;
    }

    // Nenhum dia em comum: o início de uma safra precisa ser depois do
    // fim da anterior (<= também barra o mesmo dia).
    for (let i = 1; i < periodos.length; i++) {
      if (periodos[i].inicio <= periodos[i - 1].fim) {
        setMensagem(
          `${rotulo(periodos[i - 1])} e ${rotulo(periodos[i])} ` +
          "têm dias em comum. Os períodos não podem se sobrepor " +
          "nem compartilhar nenhum dia."
        );
        return;
      }
    }

    setCarregando(true);

    try {
      const projection = await fetch(`${IA_API_URL}/crs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          coordenadas: coordenadas,
        }),
      });

      const projecoes = await projection.json();
      const crs = projecoes.crs;
      const crs_transformation = projecoes.crs_transformation;

      const resposta = await fetch(`${AUTH_API_URL}/lavoura`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Usuario-Id": usuarioId,
        },
        body: JSON.stringify({
          usuarioId: usuarioId,
          nomeLavoura: nome.trim(),
          coordenadas,
          crs: crs,
          crs_transformation: crs_transformation,
          safras: periodos,
        }),
      });

      const dados = await resposta.json();

      if (resposta.ok) {
        toast.sucesso("Lavoura cadastrada com sucesso!");

        if (dados.mapas) {
          if (dados.mapas.status === "aceito") {
            toast.sucesso(dados.mapas.mensagem);
            toast.info(
              "Processamento solicitado. As séries das safras e os mapas " +
              "serão gerados em segundo plano."
            );

            for (const safra of periodos) {
              // Ponto de extensão da safra atual: safra.atual === true
              // (fim = dia do cadastro). Trate-a de forma específica aqui.
              const respostaSerie = await fetch(`${IA_API_URL}/time_series`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "coordenadas": JSON.stringify(coordenadas),
                  "lavouraId": dados.id,
                  "usuarioId": usuarioId,
                  "crs": crs,
                  "crsTransform": crs_transformation,
                  "dataInicio": safra.inicio,
                  "dataFim": safra.fim,
                  "anoSafra": safra.ano,
                },
              });

              const nomeSafra = safra.atual
                ? "atual"
                : String(safra.ano);

              if (!respostaSerie.ok) {
                const erroSerie = await respostaSerie.json();
                toast.erro(`Erro ao solicitar série temporal para a safra ${nomeSafra}: ${erroSerie.mensagem || "Erro desconhecido"}`);
              } else {
                toast.sucesso(`Série temporal solicitada para a safra ${nomeSafra}.`);
              }
            }
          } else {
            toast.erro(`Lavoura salva. ${dados.mapas.mensagem}`);
            toast.erro(
              "A lavoura foi salva, mas o processamento não foi confirmado. " +
              "Use Gerar imagens no histórico para tentar novamente."
            );
          }
        }
        navigate("/home");
      } else {
        setMensagem(dados.mensagem || "Erro ao cadastrar lavoura.");
      }
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
                Informe quando a safra atual começou e, se quiser,
                os períodos de safras anteriores.
                O ano identifica a safra pela colheita.
              </p>

              <small>
                Imagens disponíveis a partir de 28/03/2017.
                A disponibilidade varia conforme a região e as nuvens.
                Duas safras não podem começar no mesmo ano, terminar no
                mesmo ano nem ter um dia em comum.
              </small>
            </div>

            {/* SAFRA ATUAL (especial): só o início; o fim é hoje */}
            <fieldset
              className="cad-safra cad-safra--atual"
              disabled={carregando}
            >
              <legend>Safra atual</legend>

              <div className="cad-safra-campos cad-safra-campos--unico">
                <TextField
                  label="Início da safra atual"
                  type="date"
                  min={DATA_MINIMA}
                  max={hojeTexto}
                  value={inicioSafraAtual}
                  onChange={(evento) =>
                    setInicioSafraAtual(evento.target.value)
                  }
                  required
                />
              </div>

              <p className="cad-safra-nota">
                O fim da safra atual é hoje ({formatarDataBR(hojeTexto)}),
                o dia do cadastro.
              </p>
            </fieldset>

            {/* Safras anteriores */}
            {safras.map((safra, indice) => (
              <fieldset
                className="cad-safra"
                key={indice}
                disabled={carregando}
              >
                <legend>Safra anterior {indice + 1}</legend>

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
                    min={DATA_MINIMA}
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
                    min={safra.inicio || DATA_MINIMA}
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
                  disabled={carregando}
                  onClick={() => removerSafra(indice)}
                >
                  Remover safra
                </Button>
              </fieldset>
            ))}

            <Button
              type="button"
              variant="secondary"
              disabled={carregando || safras.length >= 29}
              onClick={adicionarSafra}
            >
              Adicionar safra anterior
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
