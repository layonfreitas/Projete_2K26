import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { useParams } from "react-router-dom";

import {
  criarLaudoPdf,
  nomeArquivoLaudo,
} from "../services/relatoriosPdf";

import {
  buscarJson,
  validarMapa,
} from "../services/historicoAPI";

import { AUTH_API_URL } from "../config/api";
import logoIcone from "../assets/logo-icone.jpeg";

import AppBar from "../components/ui/AppBar";
import Button from "../components/ui/Button";
import { useToast } from "../components/ui/toastContext";




import "./laudo.css";

const TIPOS = {
  NDVI: "Vegetação",
  NDRE: "Resposta da vegetação à clorofila",
  NDWI: "Água na vegetação",

  "z-score-NDVI": "Variação espacial da vegetação",
  "z-score-NDRE": "Variação espacial da resposta à clorofila",
  "z-score-NDWI": "Variação espacial do indicador de água",

  z_score_NDVI_final: "Anomalias da vegetação no histórico",
  z_score_NDRE_final: "Anomalias da resposta à clorofila no histórico",
  z_score_NDWI_final: "Anomalias do indicador de água no histórico",
};

function chaveRegistro(item) {
  return JSON.stringify([item.data, item.contorno]);
}

function formatarData(data) {
  return data
    ? data.split("-").reverse().join("/")
    : "Não informada";
}

function hoje() {
  const data = new Date();

  return [
    data.getFullYear(),
    String(data.getMonth() + 1).padStart(2, "0"),
    String(data.getDate()).padStart(2, "0"),
  ].join("-");
}

function CampoLongo({
  id,
  rotulo,
  value,
  onChange,
  placeholder,
}) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    if (!ref.current) return;

    ref.current.style.height = "auto";
    ref.current.style.height =
      `${ref.current.scrollHeight + 2}px`;
  }, [value]);

  return (
    <textarea
      id={id}
      ref={ref}
      aria-label={rotulo}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={4}
    />
  );
}

// Prepara apenas a imagem do mapa, sem capturar a tela.
// A prévia e o PDF utilizam exatamente a mesma imagem.
function carregarImagem(url, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Cancelado", "AbortError"));
      return;
    }

    const imagem = new Image();
    imagem.crossOrigin = "anonymous";

    let terminou = false;
    let timer;

    function concluir(erro, resultado) {
      if (terminou) return;

      terminou = true;

      clearTimeout(timer);
      signal?.removeEventListener("abort", cancelar);

      imagem.onload = null;
      imagem.onerror = null;

      if (erro) {
        imagem.src = "";
        reject(erro);
      } else {
        resolve(resultado);
      }
    }

    function cancelar() {
      concluir(new DOMException("Cancelado", "AbortError"));
    }

    signal?.addEventListener("abort", cancelar, {
      once: true,
    });

    timer = setTimeout(() => {
      concluir(
        new Error(
          "A imagem demorou para carregar. Tente novamente."
        )
      );
    }, 45000);

    imagem.onerror = () => {
      concluir(
        new Error(
          "Não foi possível carregar a imagem para o PDF. Tente novamente."
        )
      );
    };

    imagem.onload = () => {
      try {
        const canvas = document.createElement("canvas");

        const escala = Math.min(
          1,
          1800 /
            Math.max(
              imagem.naturalWidth,
              imagem.naturalHeight
            )
        );

        canvas.width = Math.max(
          1,
          Math.round(imagem.naturalWidth * escala)
        );

        canvas.height = Math.max(
          1,
          Math.round(imagem.naturalHeight * escala)
        );

        const ctx = canvas.getContext("2d");

        if (!ctx) {
          throw new Error("Canvas indisponível.");
        }

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.drawImage(
          imagem,
          0,
          0,
          canvas.width,
          canvas.height
        );

        concluir(null, canvas.toDataURL("image/png"));
      } catch {
        concluir(
          new Error(
            "Não foi possível preparar a imagem. " +
              "Verifique se o servidor de imagens permite acesso pelo navegador."
          )
        );
      }
    };

    imagem.src = url;
  });
}

export default function Laudo() {
  const { id } = useParams();
  const toast = useToast();

  const lavouraId = String(
    id || localStorage.getItem("lavouraId") || ""
  );

  const usuarioId = String(
    (
      localStorage.getItem("usuarioTipo") === "agronomo"
        ? localStorage.getItem("produtorSelecionadoId")
        : localStorage.getItem("usuarioId")
    ) || ""
  );

  const contexto = JSON.stringify([
    usuarioId,
    lavouraId,
  ]);

  const produtorNome =
    localStorage.getItem("produtorSelecionadoNome") ||
    "Produtor não informado";

  const [dataAnalise, setDataAnalise] = useState(hoje);
  const [responsavel, setResponsavel] = useState("");
  const [resumo, setResumo] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [recomendacoes, setRecomendacoes] = useState("");

  const [acao, setAcao] = useState("");
  const trava = useRef(false);

  const [tentativa, setTentativa] = useState(0);
  const [tentativaMapa, setTentativaMapa] = useState(0);

  const [catalogo, setCatalogo] = useState({
    chave: "",
    itens: [],
    lavoura: null,
    erro: "",
  });

  const [selecao, setSelecao] = useState({
    contexto: "",
    registro: "",
    indice: "",
    legenda: "",
  });

  const [resultado, setResultado] = useState({
    chave: "",
    imagem: "",
    erro: "",
  });

  const chaveCatalogo = JSON.stringify([
    contexto,
    tentativa,
  ]);

  const catalogoAtual =
    catalogo.chave === chaveCatalogo;

  const itens = catalogoAtual ? catalogo.itens : [];

  const lavoura = catalogoAtual
    ? catalogo.lavoura
    : null;

  const lavouraNome =
    lavoura?.nomeLavoura ||
    `Lavoura ${lavouraId || "não selecionada"}`;

  const erroCatalogo =
    !usuarioId || !lavouraId
      ? "Selecione um produtor e uma lavoura."
      : catalogoAtual
        ? catalogo.erro
        : "";

  const carregandoCatalogo = Boolean(
    usuarioId && lavouraId && !catalogoAtual
  );

  const registro =
    selecao.contexto === contexto
      ? itens.find(
          (item) =>
            chaveRegistro(item) === selecao.registro
        )
      : null;

  const indice =
    registro?.indicesDisponiveis.includes(selecao.indice)
      ? selecao.indice
      : "";

  // A chave inclui data, contorno e tipo.
  // Uma resposta antiga não pode substituir a seleção atual.
  const chaveMapa =
    registro && indice
      ? JSON.stringify([
          contexto,
          registro.data,
          registro.contorno,
          indice,
          tentativa,
          tentativaMapa,
        ])
      : "";

  const mapaPronto = Boolean(
    chaveMapa &&
      resultado.chave === chaveMapa &&
      resultado.imagem
  );

  const erroMapa =
    chaveMapa && resultado.chave === chaveMapa
      ? resultado.erro
      : "";

  const carregandoMapa = Boolean(
    chaveMapa && resultado.chave !== chaveMapa
  );

  const ocupado = Boolean(acao);

  const podeEmitir = Boolean(
    lavoura &&
      !erroCatalogo &&
      !carregandoCatalogo &&
      (!chaveMapa || mapaPronto)
  );

  const dataImagem = mapaPronto
    ? registro.data
    : "";

  // Busca a lavoura e os mapas disponíveis.
  useEffect(() => {
    const controller = new AbortController();

    if (!usuarioId || !lavouraId) {
      return () => controller.abort();
    }

    async function consultar() {
      try {
        const lavouras = await buscarJson(
          `${AUTH_API_URL}/lavouras/${encodeURIComponent(usuarioId)}`,
          controller.signal
        );

        if (!Array.isArray(lavouras)) {
          throw new Error(
            "Resposta inválida ao consultar as lavouras."
          );
        }

        const encontrada = lavouras.find(
          (item) => String(item.id) === lavouraId
        );

        if (!encontrada) {
          throw new Error(
            "A lavoura não foi encontrada para o produtor selecionado."
          );
        }

        let registros = [];
        let erroImagens = "";

        try {
          const dados = await buscarJson(
            `${AUTH_API_URL}/imagens/${encodeURIComponent(lavouraId)}` +
              `?usuario_id=${encodeURIComponent(usuarioId)}`,
            controller.signal
          );

          if (!Array.isArray(dados)) {
            throw new Error(
              "Resposta inválida ao consultar os mapas."
            );
          }

          registros = dados
            .filter(
              (item) =>
                /^\d{4}-\d{2}-\d{2}$/.test(
                  item.data || ""
                ) && item.contorno
            )
            .map((item) => ({
              ...item,
              indicesDisponiveis: [
                ...new Set(
                  (
                    Array.isArray(item.indicesDisponiveis)
                      ? item.indicesDisponiveis
                      : []
                  ).filter((nome) =>
                    Object.hasOwn(TIPOS, nome)
                  )
                ),
              ],
            }))
            .filter(
              (item) => item.indicesDisponiveis.length
            )
            .sort((a, b) =>
              b.data.localeCompare(a.data)
            );
        } catch (erro) {
          if (controller.signal.aborted) return;

          erroImagens = erro.message;
        }

        if (!controller.signal.aborted) {
          setCatalogo({
            chave: chaveCatalogo,
            itens: registros,
            lavoura: encontrada,
            erro: "",
            erroImagens,
          });
        }
      } catch (erro) {
        if (!controller.signal.aborted) {
          setCatalogo({
            chave: chaveCatalogo,
            itens: [],
            lavoura: null,
            erro: erro.message,
          });
        }
      }
    }

    consultar();

    return () => controller.abort();
  }, [usuarioId, lavouraId, chaveCatalogo]);

  // Carrega e prepara somente o mapa selecionado.
  useEffect(() => {
    const controller = new AbortController();

    if (!chaveMapa) {
      return () => controller.abort();
    }

    const [
      contextoMapa,
      data,
      contorno,
      tipo,
    ] = JSON.parse(chaveMapa);

    const [
      usuario,
      lavouraSelecionada,
    ] = JSON.parse(contextoMapa);

    async function consultar() {
      try {
        const params = new URLSearchParams({
          usuario_id: usuario,
          id: lavouraSelecionada,
          data,
          indice: tipo,
          contorno,
        });

        const dados = await buscarJson(
          `${AUTH_API_URL}/acessar_imagem?${params}`,
          controller.signal
        );

        validarMapa(
          dados,
          lavouraSelecionada,
          usuario
        );

        const imagem = await carregarImagem(
          dados.url,
          controller.signal
        );

        if (!controller.signal.aborted) {
          setResultado({
            chave: chaveMapa,
            imagem,
            erro: "",
          });
        }
      } catch (erro) {
        if (!controller.signal.aborted) {
          setResultado({
            chave: chaveMapa,
            imagem: "",
            erro: erro.message,
          });
        }
      }
    }

    consultar();

    return () => controller.abort();
  }, [chaveMapa]);

  function selecionarMapa(item, tipo) {
    setSelecao({
      contexto,
      registro: item ? chaveRegistro(item) : "",
      indice: tipo || "",
      legenda: item
        ? `${TIPOS[tipo]}. ` +
          `Imagem de ${formatarData(item.data)}; ` +
          `contorno ${item.versaoContorno ?? "registrado"}.`
        : "",
    });
  }

  async function emitir(enviarEmail) {
    if (trava.current || !podeEmitir) return;

    trava.current = true;
    setAcao(enviarEmail ? "email" : "pdf");

    try {
      const logo = await carregarImagem(logoIcone);

      const pdf = criarLaudoPdf({
        produtorNome,
        lavouraNome,
        dataSelecionada: dataAnalise,
        dataImagem,
        responsavel,
        resumo,
        observacoes,
        recomendacoes,
        logo,
        mapa: mapaPronto ? resultado.imagem : null,
        legendaMapa: mapaPronto
          ? selecao.legenda
          : "",
      });

      const nomeArquivo =
        nomeArquivoLaudo(lavouraNome);

      if (!enviarEmail) {
        pdf.save(nomeArquivo);

        toast.sucesso(
          "PDF gerado. Confira a pasta de downloads."
        );
      } else {
        const resposta = await fetch(
          `${AUTH_API_URL}/laudo/enviar_email`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              lavouraId,
              usuarioId,
              nomeArquivo,
              pdfBase64: pdf
                .output("datauristring")
                .split(",")
                .pop(),
            }),
          }
        );

        const dados = await resposta.json();

        if (!resposta.ok) {
          throw new Error(
            dados.mensagem ||
              "Não foi possível enviar o laudo."
          );
        }

        toast.sucesso(
          dados.email
            ? `Laudo enviado para ${dados.email}.`
            : "Laudo enviado.",
          7000
        );
      }
    } catch (erro) {
      toast.erro(
        erro.message ||
          "Não foi possível emitir o laudo."
      );
    } finally {
      trava.current = false;
      setAcao("");
    }
  }

  return (
    <div className="ui-coluna ui-coluna--larga ui-coluna--sem-nav laudo-pagina">
      <AppBar
        titulo="Laudo técnico"
        subtitulo={lavouraNome}
        para="/home"
      />

      <main className="ui-conteudo">
        <div className="laudo-introducao">
          <div>
            <span className="laudo-eyebrow">
              ACOMPANHAMENTO DA LAVOURA
            </span>

            <h1>Preparar laudo</h1>

            <p>
              Escolha um mapa já gerado e registre suas
              observações.
            </p>
          </div>

          <span className="laudo-selo">
            Documento em PDF
          </span>
        </div>

        <div className="laudo-card">
          <header className="laudo-header">
            <div className="laudo-header-text">
              <span className="laudo-marca">
                COFFEEVISION
              </span>

              <h2>Laudo da lavoura</h2>

              <p>
                Informações e orientações para o produtor.
              </p>
            </div>

            <div className="laudo-icon">
              <img
                src={logoIcone}
                alt="CoffeeVision"
              />
            </div>
          </header>

          {carregandoCatalogo && (
            <p role="status">
              Consultando a lavoura e os mapas...
            </p>
          )}

          {erroCatalogo && (
            <p role="alert">{erroCatalogo}</p>
          )}

          <fieldset
            className="laudo-formulario"
            disabled={ocupado}
          >
            <legend className="laudo-sr-only">
              Informações do laudo
            </legend>

            <section className="laudo-section">
              <h3 className="laudo-section-title">
                01 · Identificação
              </h3>

              <div className="laudo-info-grid">
                <div className="laudo-field">
                  <span className="laudo-label">
                    Produtor
                  </span>
                  <span className="laudo-valor">
                    {produtorNome}
                  </span>
                </div>

                <div className="laudo-field">
                  <span className="laudo-label">
                    Lavoura
                  </span>
                  <span className="laudo-valor">
                    {lavouraNome}
                  </span>
                </div>

                <div className="laudo-field">
                  <label
                    className="laudo-label"
                    htmlFor="laudo-data"
                  >
                    Data da análise
                  </label>

                  <input
                    id="laudo-data"
                    type="date"
                    value={dataAnalise}
                    onChange={(e) =>
                      setDataAnalise(e.target.value)
                    }
                  />
                </div>

                <div className="laudo-field">
                  <span className="laudo-label">
                    Data da imagem
                  </span>

                  <span className="laudo-valor">
                    {mapaPronto
                      ? formatarData(dataImagem)
                      : "Nenhum mapa pronto"}
                  </span>

                  <small>
                    Preenchida automaticamente após carregar
                    o mapa.
                  </small>
                </div>

                <div className="laudo-field laudo-field--inteiro">
                  <label
                    className="laudo-label"
                    htmlFor="laudo-responsavel"
                  >
                    Responsável pela análise
                  </label>

                  <input
                    id="laudo-responsavel"
                    value={responsavel}
                    onChange={(e) =>
                      setResponsavel(e.target.value)
                    }
                    placeholder="Nome e registro profissional, se aplicável"
                  />
                </div>
              </div>

              <p className="laudo-ajuda">
                A emissão recebe automaticamente a data e
                o horário de geração do PDF.
              </p>
            </section>

            <section className="laudo-section">
              <h3 className="laudo-section-title">
                02 · Resumo da análise
              </h3>

              <div className="laudo-field">
                <CampoLongo
                  rotulo="Resumo da análise"
                  value={resumo}
                  onChange={(e) =>
                    setResumo(e.target.value)
                  }
                  placeholder="Explique a situação observada. Se a análise estiver indisponível, informe aqui."
                />
              </div>
            </section>

            <section className="laudo-section">
              <h3 className="laudo-section-title">
                03 · Mapa da lavoura
                <span className="laudo-opcional">
                  opcional
                </span>
              </h3>

              <p className="laudo-section-description">
                Escolha a data e a versão do contorno.
                Depois escolha o mapa que deseja incluir.
              </p>

              {catalogoAtual &&
                catalogo.erroImagens && (
                  <p role="alert">
                    {catalogo.erroImagens} Você pode tentar
                    novamente ou emitir sem mapa.
                  </p>
                )}

              {catalogoAtual &&
                !catalogo.erro &&
                !catalogo.erroImagens &&
                !itens.length && (
                  <p>
                    Nenhum mapa disponível. Você pode emitir
                    o laudo sem mapa.
                  </p>
                )}

              <div className="laudo-info-grid">
                <div className="laudo-field">
                  <label
                    className="laudo-label"
                    htmlFor="laudo-registro"
                  >
                    Data e contorno
                  </label>

                  <select
                    id="laudo-registro"
                    value={
                      registro
                        ? chaveRegistro(registro)
                        : ""
                    }
                    disabled={
                      carregandoCatalogo || !itens.length
                    }
                    onChange={(e) => {
                      const item = itens.find(
                        (r) =>
                          chaveRegistro(r) ===
                          e.target.value
                      );

                      selecionarMapa(
                        item,
                        item?.indicesDisponiveis[0]
                      );
                    }}
                  >
                    <option value="">
                      Emitir sem mapa
                    </option>

                    {itens.map((item) => (
                      <option
                        key={chaveRegistro(item)}
                        value={chaveRegistro(item)}
                      >
                        {formatarData(item.data)}
                        {" · Contorno "}
                        {item.versaoContorno ?? "registrado"}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="laudo-field">
                  <label
                    className="laudo-label"
                    htmlFor="laudo-tipo-mapa"
                  >
                    Mapa disponível
                  </label>

                  <select
                    id="laudo-tipo-mapa"
                    value={indice}
                    disabled={!registro}
                    onChange={(e) =>
                      selecionarMapa(
                        registro,
                        e.target.value
                      )
                    }
                  >
                    {!registro && (
                      <option value="">
                        Selecione uma data
                      </option>
                    )}

                    {registro?.indicesDisponiveis.map(
                      (tipo) => (
                        <option key={tipo} value={tipo}>
                          {TIPOS[tipo]}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              <button
                type="button"
                className="laudo-remover"
                style={{ marginTop: 12 }}
                disabled={carregandoCatalogo}
                onClick={() => {
                  selecionarMapa(null);
                  setTentativa((n) => n + 1);
                }}
              >
                Atualizar mapas disponíveis
              </button>

              {carregandoMapa && (
                <p
                  role="status"
                  className="laudo-ajuda"
                >
                  Preparando o mapa para a prévia e o PDF...
                </p>
              )}

              {erroMapa && (
                <div role="alert">
                  <p>{erroMapa}</p>

                  <button
                    type="button"
                    className="laudo-remover"
                    onClick={() =>
                      setTentativaMapa((n) => n + 1)
                    }
                  >
                    Tentar carregar novamente
                  </button>

                  <button
                    type="button"
                    className="laudo-remover"
                    onClick={() => selecionarMapa(null)}
                  >
                    Continuar sem mapa
                  </button>
                </div>
              )}

              {mapaPronto && (
                <div className="laudo-mapa-container">
                  <img
                    className="laudo-mapa"
                    src={resultado.imagem}
                    alt={
                      `Mapa de ${TIPOS[indice]} ` +
                      `de ${formatarData(dataImagem)}`
                    }
                  />

                  <p className="laudo-ajuda">
                    Esta é a imagem gerada pelo sistema
                    que será incluída no PDF.
                  </p>

                  <div className="laudo-field">
                    <label
                      className="laudo-label"
                      htmlFor="laudo-legenda"
                    >
                      Descrição e legenda do mapa
                    </label>

                    <CampoLongo
                      id="laudo-legenda"
                      rotulo="Descrição e legenda do mapa"
                      value={selecao.legenda}
                      onChange={(e) =>
                        setSelecao((anterior) => ({
                          ...anterior,
                          legenda: e.target.value,
                        }))
                      }
                      placeholder="Descreva as áreas sinalizadas."
                    />
                  </div>

                  <button
                    type="button"
                    className="laudo-remover"
                    onClick={() => selecionarMapa(null)}
                  >
                    Retirar mapa do laudo
                  </button>
                </div>
              )}
            </section>

            <section className="laudo-section">
              <h3 className="laudo-section-title">
                04 · Observações em campo
              </h3>

              <div className="laudo-field">
                <CampoLongo
                  rotulo="Observações em campo"
                  value={observacoes}
                  onChange={(e) =>
                    setObservacoes(e.target.value)
                  }
                  placeholder="Registre as condições observadas na lavoura."
                />
              </div>
            </section>

            <section className="laudo-section">
              <h3 className="laudo-section-title">
                05 · Orientações ao produtor
              </h3>

              <div className="laudo-field">
                <CampoLongo
                  rotulo="Orientações ao produtor"
                  value={recomendacoes}
                  onChange={(e) =>
                    setRecomendacoes(e.target.value)
                  }
                  placeholder="Informe os próximos passos e o acompanhamento recomendado."
                />
              </div>
            </section>
          </fieldset>

          <div className="laudo-nota">
            Confira a data e o contorno do mapa.
            As observações e orientações são preenchidas
            pelo responsável; não são diagnósticos
            automáticos.
          </div>
        </div>
      </main>

      <div className="laudo-barra">
        <span className="laudo-barra-texto">
          {carregandoMapa
            ? "Aguarde o carregamento do mapa."
            : "Revise antes de emitir."}
        </span>

        <div className="laudo-actions">
          <Button
            variant="secondary"
            icon="baixar"
            loading={acao === "pdf"}
            disabled={ocupado || !podeEmitir}
            onClick={() => emitir(false)}
          >
            Baixar PDF
          </Button>

          <Button
            icon="email"
            loading={acao === "email"}
            disabled={ocupado || !podeEmitir}
            onClick={() => emitir(true)}
          >
            Enviar por e-mail
          </Button>
        </div>
      </div>
    </div>
  );
}