import { useLocation, useNavigate } from "react-router-dom";
import { useRef, useState } from "react";
import { AUTH_API_URL } from "../config/api";
import AppBar from "../components/ui/AppBar";
import Button from "../components/ui/Button";
import { TextField } from "../components/ui/Field";
import { EmptyState, Notice } from "../components/ui/States";
import { calcularAreaHectares, formatarHectares, pontosParaSvg } from "../utils/geo";
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

// Mensagem específica para cada tipo de resposta do servidor.
function mensagemDoServidor(status, detalhe) {
  if (status === 401) {
    return "Sua sessão expirou. Entre na conta novamente e refaça o cadastro.";
  }
  if (status === 403) {
    return "Esta conta não tem permissão para cadastrar lavouras.";
  }
  if (status === 409) {
    return detalhe || "Já existe uma lavoura com estes dados. Confira suas lavouras antes de cadastrar de novo.";
  }
  if (status === 413) {
    return "Os dados enviados são grandes demais. Reduza a quantidade de pontos do contorno ou de safras e tente de novo.";
  }
  if (status === 429) {
    return "Muitas tentativas seguidas. Aguarde um minuto e tente novamente.";
  }
  if (status === 400 || status === 422) {
    return detalhe
      ? `O servidor não aceitou o cadastro: ${detalhe}`
      : "O servidor não aceitou os dados enviados. Revise o nome, o contorno e as datas das safras.";
  }
  return detalhe || "Não foi possível salvar a lavoura. Tente novamente.";
}

export default function Cadastro() {
  const navigate = useNavigate();
  const location = useLocation();
  const envioEmAndamento = useRef(false);

  const coordenadas = location.state?.coordenadas;

  const [nome, setNome] = useState("");
  const [erroNome, setErroNome] = useState("");
  // Erros por campo de safra: "atual" ou "<posição>-inicio" / "<posição>-fim".
  const [errosSafras, setErrosSafras] = useState({});
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [cadastroSalvo, setCadastroSalvo] = useState(null);
  const [cadastroIncerto, setCadastroIncerto] = useState(false);

  // SAFRA ATUAL (especial): o usuário informa apenas o início.
  // O fim é sempre o dia em que a lavoura é cadastrada.
  const [inicioSafraAtual, setInicioSafraAtual] = useState("");

  // Safras anteriores (histórico). Podem ser zero.
  const [safras, setSafras] = useState([]);

  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const hojeTexto = formatarData(hoje);

  function limparErroSafra(chave) {
    setErrosSafras((anteriores) => {
      if (!anteriores[chave]) return anteriores;
      const resto = { ...anteriores };
      delete resto[chave];
      return resto;
    });
  }

  function alterarSafra(indice, campo, valor) {
    limparErroSafra(`${indice}-${campo}`);
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
      { inicio: "", fim: "" },
    ]);
  }

  function removerSafra(indice) {
    // As posições mudam; os avisos antigos deixariam de valer.
    setErrosSafras({});
    setSafras((anteriores) =>
      anteriores.filter((_, posicao) => posicao !== indice)
    );
  }

  const temPoligono = Array.isArray(coordenadas) && coordenadas.length >= 3;
  const area_hectares = calcularAreaHectares(coordenadas);

  async function salvarCadastro(evento) {
    evento.preventDefault();

    if (envioEmAndamento.current || cadastroSalvo || cadastroIncerto) return;

    setMensagem("");
    setErroNome("");
    setErrosSafras({});

    const usuarioId = localStorage.getItem("usuarioId");

    if (!usuarioId) {
      setMensagem("Sua sessão não foi encontrada. Entre na conta antes de cadastrar a lavoura.");
      return;
    }

    if (!coordenadas || !temPoligono) {
      setMensagem("Falta o contorno da lavoura. Volte ao mapa e marque pelo menos 3 pontos.");
      return;
    }

    // Data recalculada no momento do envio: é o "dia do cadastro".
    const dataCadastro = formatarData(new Date());
    const anoCadastro = Number(dataCadastro.slice(0, 4));

    const erros = {};
    let erroDeNome = "";

    // ---- Nome ----
    if (!nome.trim()) {
      erroDeNome = "Dê um nome para identificar a lavoura (ex.: Lavoura Boa Vista).";
    } else if (nome.trim().length < 3) {
      erroDeNome = "O nome está muito curto. Use pelo menos 3 letras.";
    }

    // ---- Safra atual (especial) ----
    // Fim = dia do cadastro. O ano da safra é o ano do cadastro.
    const safraAtual = {
      ano: anoCadastro,
      inicio: inicioSafraAtual,
      fim: dataCadastro,
      atual: true,
      chave: "atual",
    };

    if (!safraAtual.inicio) {
      erros.atual = "Informe o dia em que a safra atual começou.";
    } else if (safraAtual.inicio < DATA_MINIMA) {
      erros.atual = `Esta data é anterior a ${formatarDataBR(DATA_MINIMA)}, quando começam as imagens de satélite. Escolha uma data a partir de ${formatarDataBR(DATA_MINIMA)}.`;
    } else if (safraAtual.inicio > safraAtual.fim) {
      erros.atual = "O início da safra atual não pode estar no futuro.";
    }

    // ---- Safras anteriores ----
    const periodosAnteriores = safras.map((safra, posicao) => ({
      ano: safra.inicio ? Number(safra.inicio.slice(0, 4)) : null,
      inicio: safra.inicio,
      fim: safra.fim,
      atual: false,
      chave: String(posicao),
    }));

    periodosAnteriores.forEach((safra, posicao) => {
      const nomeSafra = `Safra anterior ${posicao + 1}`;

      if (!safra.inicio) {
        erros[`${posicao}-inicio`] = `${nomeSafra}: informe a data de início.`;
      } else if (safra.inicio < DATA_MINIMA) {
        erros[`${posicao}-inicio`] = `${nomeSafra}: o início não pode ser antes de ${formatarDataBR(DATA_MINIMA)}.`;
      } else if (safra.inicio > dataCadastro) {
        erros[`${posicao}-inicio`] = `${nomeSafra}: o início não pode estar no futuro.`;
      }

      if (!safra.fim) {
        erros[`${posicao}-fim`] = `${nomeSafra}: informe a data de fim.`;
      } else if (safra.fim > dataCadastro) {
        erros[`${posicao}-fim`] = `${nomeSafra}: o fim não pode estar no futuro. Use no máximo hoje (${formatarDataBR(dataCadastro)}).`;
      } else if (safra.inicio && safra.fim < safra.inicio) {
        erros[`${posicao}-fim`] = `${nomeSafra}: o fim (${formatarDataBR(safra.fim)}) vem antes do início (${formatarDataBR(safra.inicio)}).`;
      }
    });

    // Todas as safras juntas (anteriores + atual), ordenadas pelo início.
    const periodos = [...periodosAnteriores, safraAtual].sort((a, b) =>
      (a.inicio || "").localeCompare(b.inicio || "")
    );

    const rotulo = (safra) =>
      safra.atual ? "a safra atual" : `a safra anterior ${Number(safra.chave) + 1}`;

    const campoInicio = (safra) =>
      safra.atual ? "atual" : `${safra.chave}-inicio`;

    // Conflitos entre safras só são conferidos entre datas já válidas.
    const validas = periodos.filter(
      (safra) => !erros[campoInicio(safra)] && !erros[`${safra.chave}-fim`]
    );

    // Duas safras não podem começar no mesmo ano.
    const vistos = new Map();
    for (const safra of validas) {
      const anoInicio = safra.inicio.slice(0, 4);
      const anterior = vistos.get(anoInicio);

      if (anterior) {
        const alvo = campoInicio(safra);
        erros[alvo] =
          `${rotulo(safra)[0].toUpperCase()}${rotulo(safra).slice(1)} começa em ${anoInicio}, ` +
          `o mesmo ano d${rotulo(anterior)}. Cada safra deve começar em um ano diferente.`;
      } else {
        vistos.set(anoInicio, safra);
      }
    }

    // O ano (colheita) também não pode se repetir.
    const anosColheita = new Map();
    for (const safra of validas) {
      const anterior = anosColheita.get(safra.ano);

      if (anterior && !erros[campoInicio(safra)]) {
        erros[campoInicio(safra)] =
          `${rotulo(safra)[0].toUpperCase()}${rotulo(safra).slice(1)} usa o mesmo ano de safra (${safra.ano}) ` +
          `d${rotulo(anterior)}. Informe cada ano apenas uma vez.`;
      } else if (!anterior) {
        anosColheita.set(safra.ano, safra);
      }
    }

    // Nenhum dia em comum: o início de uma safra precisa ser depois do
    // fim da anterior (<= também barra o mesmo dia).
    for (let i = 1; i < validas.length; i++) {
      const anterior = validas[i - 1];
      const atual = validas[i];
      const alvo = campoInicio(atual);

      if (!erros[alvo] && atual.inicio <= anterior.fim) {
        erros[alvo] =
          `Esta safra começa em ${formatarDataBR(atual.inicio)}, mas ${rotulo(anterior)} ` +
          `termina em ${formatarDataBR(anterior.fim)}. O início precisa ser depois do fim da anterior.`;
      }
    }

    const quantidade = Object.keys(erros).length + (erroDeNome ? 1 : 0);

    if (quantidade > 0) {
      setErroNome(erroDeNome);
      setErrosSafras(erros);
      setMensagem(
        quantidade === 1
          ? "Há 1 campo para corrigir. Veja o aviso destacado no formulário."
          : `Há ${quantidade} campos para corrigir. Veja os avisos destacados no formulário.`
      );
      // Leva o foco ao primeiro campo com problema.
      requestAnimationFrame(() => {
        document.querySelector('input[aria-invalid="true"]')?.focus();
      });
      return;
    }

    envioEmAndamento.current = true;
    setCarregando(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    try {
      // O backend salva a lavoura e solicita mapas e séries das safras.
      // Não duplicar o processamento com chamadas diretas à API de IA.
      const resposta = await fetch(`${AUTH_API_URL}/lavoura`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Usuario-Id": usuarioId,
        },
        signal: controller.signal,
        body: JSON.stringify({
          usuarioId,
          nomeLavoura: nome.trim(),
          coordenadas,
          safras: periodos.map((safra) => ({
            ano: safra.ano,
            inicio: safra.inicio,
            fim: safra.fim,
            atual: safra.atual,
          })),
        }),
      });

      const dados = await resposta.json().catch(() => ({}));
      console.info("[CADASTRO] Resposta", {
        http: resposta.status,
        lavouraId: dados.id,
        mapas: dados.mapas?.status,
      });

      if (!resposta.ok) {
        // Um erro do servidor pode acontecer depois do commit.
        if (resposta.status >= 500) {
          const falha = new Error("Confirmação indisponível");
          falha.codigoHttp = resposta.status;
          throw falha;
        }
        setMensagem(mensagemDoServidor(resposta.status, dados.mensagem));
        return;
      }

      if (!dados.id) throw new Error("Resposta sem identificação da lavoura");
      // contorno já virou lavoura: descarta o rascunho guardado no mapa
      try { sessionStorage.removeItem("cv_rascunho_contorno"); } catch { /* ignora */ }
      setCadastroSalvo(dados);
    } catch (erro) {
      console.error("[CADASTRO] Não foi possível confirmar o resultado", erro);
      setCadastroIncerto(true);

      let motivo = "Não foi possível confirmar o resultado do cadastro.";
      if (erro?.name === "AbortError") {
        motivo = "O servidor demorou mais de 45 segundos para responder.";
      } else if (erro?.name === "TypeError") {
        motivo = "A conexão com o servidor caiu durante o envio.";
      } else if (erro?.codigoHttp) {
        motivo = `O servidor teve um problema ao salvar (erro ${erro.codigoHttp}).`;
      }

      setMensagem(
        `${motivo} A lavoura pode ter sido salva. ` +
        "Confira suas lavouras antes de cadastrar novamente."
      );
    } finally {
      clearTimeout(timeout);
      envioEmAndamento.current = false;
      setCarregando(false);
    }
  }

  if (cadastroSalvo) {
    const status = cadastroSalvo.mapas?.status;
    const posicaoFila = cadastroSalvo.mapas?.posicao;
    const avisos = {
      aceito: "A lavoura foi salva e a geração dos mapas e das séries das safras já começou. " +
        "Isso leva alguns minutos; acompanhe o resultado no histórico.",
      na_fila: `A lavoura foi salva. O serviço está processando outras lavouras, então a sua entrou na fila` +
        `${posicaoFila ? ` (posição ${posicaoFila})` : ""} e será processada automaticamente. ` +
        "Não é necessário fazer nada; volte ao histórico daqui a pouco.",
      ocupado: "A lavoura foi salva, mas o serviço de processamento estava ocupado e não aceitou o pedido. " +
        "Use o botão Gerar imagens no histórico para tentar de novo. Não é necessário cadastrar a lavoura outra vez.",
      nao_configurado: "A lavoura foi salva, mas o serviço de processamento não está configurado. " +
        "Entre em contato com o suporte.",
      nao_confirmado: "A lavoura foi salva, mas não foi possível confirmar o processamento. " +
        "Confira o histórico antes de solicitar novamente.",
    };
    return (
      <div className="ui-coluna ui-coluna--cheia ui-coluna--sem-nav">
        <AppBar titulo="Cadastro concluído" para="/home" />
        <div className="ui-conteudo">
          <div className="ui-cartao ui-formulario" role="status" aria-live="polite">
            <h2>Lavoura cadastrada com sucesso!</h2>
            <p>{nome.trim()} — cadastro {cadastroSalvo.id}.</p>
            <p>{avisos[status] || avisos.nao_confirmado}</p>
          </div>
          <Button type="button" block onClick={() => navigate("/home")}>
            Ver minhas lavouras
          </Button>
        </div>
      </div>
    );
  }

  if (!temPoligono) {
    return (
      <div className="ui-coluna ui-coluna--cheia ui-coluna--sem-nav">
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
    <div className="ui-coluna ui-coluna--cheia ui-coluna--sem-nav">
      <AppBar
        titulo="Cadastro da lavoura"
        subtitulo="Dê um nome para a área que você marcou."
        para="/mapa"
      />

      <form className="ui-conteudo cad-layout" onSubmit={salvarCadastro} noValidate>
        <div className="ui-cartao ui-formulario cad-resumo-cartao">
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
        </div>

        <div className="ui-cartao ui-formulario cad-safras-cartao">
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
                  error={errosSafras.atual}
                  onChange={(evento) => {
                    limparErroSafra("atual");
                    setInicioSafraAtual(evento.target.value);
                  }}
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
                    label="Início do período"
                    type="date"
                    min={DATA_MINIMA}
                    max={safra.fim || hojeTexto}
                    value={safra.inicio}
                    error={errosSafras[`${indice}-inicio`]}
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
                    error={errosSafras[`${indice}-fim`]}
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
        </div>

        <div className="ui-acoes-pagina cad-acoes">
          {mensagem && <Notice tipo="erro">{mensagem}</Notice>}
          <Button type="submit" size="lg" block loading={carregando} disabled={cadastroIncerto}>
            {carregando ? "Salvando…" : "Salvar cadastro"}
          </Button>
          <Button type="button" variant="secondary" block disabled={carregando} onClick={() => navigate(cadastroIncerto ? "/home" : "/mapa")}>
            {cadastroIncerto ? "Conferir minhas lavouras" : "Voltar ao mapa"}
          </Button>
        </div>
      </form>
    </div>
  );
}

