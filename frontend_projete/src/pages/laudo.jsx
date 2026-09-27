import { useState, useLayoutEffect, useRef } from "react";
import { useParams } from "react-router-dom";

import {
  criarLaudoPdf,
  nomeArquivoLaudo,
} from "../services/relatoriosPdf";

import logoIcone from "../assets/logo-icone.jpeg";
import { AUTH_API_URL } from "../config/api";

import AppBar from "../components/ui/AppBar";
import Button from "../components/ui/Button";
import { useToast } from "../components/ui/toastContext";

import "./laudo.css";

// Ajusta a altura do campo conforme o conteúdo digitado.
function CampoLongo({ value, onChange, placeholder, rotulo }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const elemento = ref.current;

    if (!elemento) return;

    elemento.style.height = "auto";
    elemento.style.height = `${elemento.scrollHeight + 2}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      aria-label={rotulo}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={4}
    />
  );
}

function dataHoje() {
  const hoje = new Date();

  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

// Prepara a logo e o mapa para inclusão no PDF.
async function carregarImagem(url) {
  const imagem = new Image();
  imagem.src = url;

  await imagem.decode();

  const canvas = document.createElement("canvas");

  const escala = Math.min(
    1,
    1800 / Math.max(imagem.width, imagem.height)
  );

  canvas.width = Math.round(imagem.width * escala);
  canvas.height = Math.round(imagem.height * escala);

  const contexto = canvas.getContext("2d");

  if (!contexto) {
    throw new Error("Não foi possível preparar a imagem.");
  }

  contexto.fillStyle = "#ffffff";
  contexto.fillRect(0, 0, canvas.width, canvas.height);

  contexto.drawImage(
    imagem,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return canvas.toDataURL("image/jpeg", 0.92);
}

export default function Laudo() {
  const toast = useToast();
  const { id } = useParams();

  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [carregandoMapa, setCarregandoMapa] = useState(false);

  const [dataAnalise, setDataAnalise] = useState(dataHoje);
  const [dataImagem, setDataImagem] = useState("");
  const [responsavel, setResponsavel] = useState("");

  const [resumo, setResumo] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [recomendacoes, setRecomendacoes] = useState("");

  const [mapa, setMapa] = useState(null);
  const [legendaMapa, setLegendaMapa] = useState("");

  const produtorNome =
    localStorage.getItem("produtorSelecionadoNome") ||
    "Produtor não informado";

  const lavouraNome =
    localStorage.getItem("lavouraNome") ||
    "Lavoura não selecionada";

  const ocupado =
    gerandoPdf || enviandoEmail || carregandoMapa;

  function obterIds() {
    const lavouraId =
      id || localStorage.getItem("lavouraId");

    const usuarioTipo = localStorage.getItem("usuarioTipo");

    const usuarioId =
      usuarioTipo === "agronomo"
        ? localStorage.getItem("produtorSelecionadoId")
        : localStorage.getItem("usuarioId");

    return { lavouraId, usuarioId };
  }

  async function anexarMapa(evento) {
    const arquivo = evento.target.files?.[0];

    if (!arquivo) return;

    evento.target.value = "";

    const formatoValido = [
      "image/png",
      "image/jpeg",
    ].includes(arquivo.type);

    const tamanhoMaximo = 10 * 1024 * 1024;

    if (!formatoValido || arquivo.size > tamanhoMaximo) {
      toast.erro(
        "Escolha uma imagem PNG ou JPEG de até 10 MB."
      );
      return;
    }

    setCarregandoMapa(true);

    const url = URL.createObjectURL(arquivo);

    try {
      const imagem = await carregarImagem(url);
      setMapa(imagem);
    } catch (erro) {
      console.error("Erro ao carregar mapa:", erro);
      toast.erro("Não foi possível abrir a imagem do mapa.");
    } finally {
      URL.revokeObjectURL(url);
      setCarregandoMapa(false);
    }
  }

  function removerMapa() {
    setMapa(null);
    setLegendaMapa("");
  }

  async function gerarPdf() {
    const logo = await carregarImagem(logoIcone);

    return criarLaudoPdf({
      produtorNome,
      lavouraNome,
      dataSelecionada: dataAnalise,
      dataImagem,
      resumo,
      observacoes,
      recomendacoes,
      responsavel,
      logo,
      mapa,
      legendaMapa,
    });
  }

  async function baixarPdf() {
    if (ocupado) return;

    setGerandoPdf(true);

    try {
      const pdf = await gerarPdf();

      pdf.save(nomeArquivoLaudo(lavouraNome));

      toast.sucesso(
        "PDF gerado. Confira a pasta de downloads."
      );
    } catch (erro) {
      console.error("Erro ao gerar PDF:", erro);
      toast.erro("Não foi possível gerar o PDF.");
    } finally {
      setGerandoPdf(false);
    }
  }

  async function enviarPorEmail() {
    if (ocupado) return;

    const { lavouraId, usuarioId } = obterIds();

    if (!lavouraId || !usuarioId) {
      toast.erro(
        "Selecione novamente o produtor e a lavoura antes de enviar."
      );
      return;
    }

    setEnviandoEmail(true);

    try {
      const pdf = await gerarPdf();

      const pdfBase64 = pdf
        .output("datauristring")
        .split(",")
        .pop();

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
            pdfBase64,
            nomeArquivo: nomeArquivoLaudo(lavouraNome),
          }),
        }
      );

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          dados.mensagem || "Erro ao enviar o laudo."
        );
      }

      toast.sucesso(
        dados.email
          ? `Laudo enviado com sucesso para ${dados.email}.`
          : "Laudo enviado com sucesso.",
        7000
      );
    } catch (erro) {
      console.error("Erro ao enviar laudo:", erro);

      toast.erro(
        "Não foi possível enviar o laudo por e-mail. Tente novamente."
      );
    } finally {
      setEnviandoEmail(false);
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
              Registre a análise e as orientações que serão
              entregues ao produtor.
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
                Informações organizadas para orientar o
                acompanhamento em campo.
              </p>
            </div>

            <div className="laudo-icon">
              <img
                src={logoIcone}
                alt="Logo CoffeeVision"
              />
            </div>
          </header>

          <fieldset
            className="laudo-formulario"
            disabled={ocupado}
          >
            <legend className="laudo-sr-only">
              Informações do laudo
            </legend>

            <section className="laudo-section">
              <h3 className="laudo-section-title">
                <span className="laudo-numero">01</span>
                Identificação
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
                  <label
                    className="laudo-label"
                    htmlFor="laudo-data-imagem"
                  >
                    Data da imagem
                    <span className="laudo-opcional">
                      opcional
                    </span>
                  </label>

                  <input
                    id="laudo-data-imagem"
                    type="date"
                    value={dataImagem}
                    onChange={(e) =>
                      setDataImagem(e.target.value)
                    }
                  />

                  <small>
                    Data de captura do mapa utilizado.
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
                    type="text"
                    value={responsavel}
                    onChange={(e) =>
                      setResponsavel(e.target.value)
                    }
                    placeholder="Nome e registro profissional, se aplicável"
                  />
                </div>
              </div>

              <p className="laudo-ajuda">
                A data e o horário de emissão serão registrados
                automaticamente ao gerar o PDF.
              </p>
            </section>

            <section className="laudo-section">
              <h3 className="laudo-section-title">
                <span className="laudo-numero">02</span>
                Resumo da análise
              </h3>

              <p className="laudo-section-description">
                Explique a situação observada e os pontos que
                precisam de atenção.
              </p>

              <div className="laudo-field">
                <CampoLongo
                  rotulo="Resumo da análise"
                  value={resumo}
                  onChange={(e) =>
                    setResumo(e.target.value)
                  }
                  placeholder="Descreva a situação da lavoura em linguagem simples. Se a análise estiver indisponível, informe aqui."
                />
              </div>
            </section>

            <section className="laudo-section">
              <h3 className="laudo-section-title">
                Mapa de referência
                <span className="laudo-opcional">
                  opcional
                </span>
              </h3>

              <p className="laudo-section-description">
                Anexe um mapa e explique na legenda as cores
                e as áreas sinalizadas.
              </p>

              <div className="laudo-upload">
                <label
                  className="laudo-label"
                  htmlFor="laudo-mapa"
                >
                  Escolher imagem do mapa
                </label>

                <input
                  id="laudo-mapa"
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={anexarMapa}
                />

                <small>PNG ou JPEG de até 10 MB.</small>
              </div>

              {carregandoMapa && (
                <p className="laudo-ajuda" role="status">
                  Preparando mapa...
                </p>
              )}

              {mapa && (
                <div className="laudo-mapa-container">
                  <img
                    className="laudo-mapa"
                    src={mapa}
                    alt="Mapa anexado ao laudo"
                  />

                  <div className="laudo-field">
                    <label
                      className="laudo-label"
                      htmlFor="laudo-legenda"
                    >
                      Legenda do mapa
                    </label>

                    <input
                      id="laudo-legenda"
                      type="text"
                      value={legendaMapa}
                      onChange={(e) =>
                        setLegendaMapa(e.target.value)
                      }
                      placeholder="Explique o significado das cores e marcações."
                    />
                  </div>

                  <button
                    type="button"
                    className="laudo-remover"
                    onClick={removerMapa}
                  >
                    Remover mapa
                  </button>
                </div>
              )}
            </section>

            <section className="laudo-section">
              <h3 className="laudo-section-title">
                <span className="laudo-numero">03</span>
                Observações em campo
              </h3>

              <p className="laudo-section-description">
                Registre o que foi observado durante o
                acompanhamento da lavoura.
              </p>

              <div className="laudo-field">
                <CampoLongo
                  rotulo="Observações em campo"
                  value={observacoes}
                  onChange={(e) =>
                    setObservacoes(e.target.value)
                  }
                  placeholder="Descreva os pontos observados, sua localização e outras informações relevantes..."
                />
              </div>
            </section>

            <section className="laudo-section">
              <h3 className="laudo-section-title">
                <span className="laudo-numero">04</span>
                Orientações ao produtor
              </h3>

              <p className="laudo-section-description">
                Informe os próximos passos de forma clara.
              </p>

              <div className="laudo-field">
                <CampoLongo
                  rotulo="Orientações ao produtor"
                  value={recomendacoes}
                  onChange={(e) =>
                    setRecomendacoes(e.target.value)
                  }
                  placeholder="Descreva as ações recomendadas e quando realizar uma nova avaliação..."
                />
              </div>
            </section>
          </fieldset>

          <div className="laudo-nota">
            Campos não preenchidos aparecerão como não
            informados no PDF. A ausência de informação não
            significa ausência de problemas na lavoura.
          </div>
        </div>
      </main>

      <div className="laudo-barra">
        <span className="laudo-barra-texto">
          Revise as informações antes de emitir.
        </span>

        <div className="laudo-actions">
          <Button
            variant="secondary"
            icon="baixar"
            onClick={baixarPdf}
            loading={gerandoPdf}
            disabled={ocupado}
          >
            {gerandoPdf ? "Gerando PDF..." : "Baixar PDF"}
          </Button>

          <Button
            icon="email"
            onClick={enviarPorEmail}
            loading={enviandoEmail}
            disabled={ocupado}
          >
            {enviandoEmail
              ? "Enviando..."
              : "Enviar por e-mail"}
          </Button>
        </div>
      </div>
    </div>
  );
}