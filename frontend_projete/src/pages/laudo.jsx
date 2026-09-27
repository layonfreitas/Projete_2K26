import { useState, useLayoutEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import logoIcone from "../assets/logo-icone.jpeg";
import { AUTH_API_URL } from "../config/api";
import AppBar from "../components/ui/AppBar";
import Button from "../components/ui/Button";
import { useToast } from "../components/ui/toastContext";
import "./laudo.css";

// Textarea que cresce junto com o texto. Assim o PDF mostra tudo que foi
// digitado (com altura fixa, o texto longo ficava cortado no documento).
function CampoLongo({ value, onChange, placeholder, rotulo }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
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

function Laudo() {
  const toast = useToast();
  const { id } = useParams();

  // Referência só do CONTEÚDO do laudo (sem os botões de ação),
  // é o que vira imagem/PDF.
  const conteudoRef = useRef(null);

  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [enviandoEmail, setEnviandoEmail] = useState(false);

  const [observacoes, setObservacoes] = useState("");
  const [recomendacoes, setRecomendacoes] = useState("");

  // Data da análise: preenchida com hoje por padrão, mas o agrônomo pode
  // alterar livremente (o laudo não depende mais de nenhuma consulta externa).
  const [dataAnalise, setDataAnalise] = useState(() => {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, "0");
    const dia = String(hoje.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  });

  const produtorNome = localStorage.getItem("produtorSelecionadoNome") || "Nome do produtor";

  const lavouraNome = localStorage.getItem("lavouraNome") || "Lavoura não selecionada";

  function obterIds() {
    const lavouraId = id || localStorage.getItem("lavouraId");

    const usuarioTipo = localStorage.getItem("usuarioTipo");
    const usuarioId =
      usuarioTipo === "agronomo"
        ? localStorage.getItem("produtorSelecionadoId")
        : localStorage.getItem("usuarioId");

    return { lavouraId, usuarioId };
  }

  // =========================================================
  // GERAR O PDF (captura o conteúdo do laudo como imagem e
  // monta um PDF em A4, quebrando em várias páginas se precisar)
  // =========================================================
  async function gerarPdf() {
    const elemento = conteudoRef.current;
    if (!elemento) return null;

    const canvas = await html2canvas(elemento, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
    });

    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF("p", "mm", "a4");
    const larguraPdf = pdf.internal.pageSize.getWidth();
    const alturaPdf = pdf.internal.pageSize.getHeight();

    const alturaImagem = (canvas.height * larguraPdf) / canvas.width;

    let alturaRestante = alturaImagem;
    let posicaoY = 0;

    // primeira página
    pdf.addImage(imgData, "PNG", 0, posicaoY, larguraPdf, alturaImagem);
    alturaRestante -= alturaPdf;

    // páginas extras, se o conteúdo for mais alto que uma página A4
    while (alturaRestante > 0) {
      posicaoY = alturaRestante - alturaImagem;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, posicaoY, larguraPdf, alturaImagem);
      alturaRestante -= alturaPdf;
    }

    return pdf;
  }

  function nomeArquivoPdf() {
    const nomeLimpo = lavouraNome
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_");
    return `laudo_${nomeLimpo}.pdf`;
  }

  // Baixa o PDF no computador do usuário
  async function baixarPdf() {
    setGerandoPdf(true);
    try {
      const pdf = await gerarPdf();
      if (pdf) {
        pdf.save(nomeArquivoPdf());
        toast.sucesso("PDF gerado. Confira a pasta de downloads.");
      }
    } catch (erro) {
      console.error("Erro ao gerar PDF:", erro);
      toast.erro("Não foi possível gerar o PDF.");
    } finally {
      setGerandoPdf(false);
    }
  }

  // Gera o PDF e manda pro backend enviar por e-mail ao produtor
  // dono da lavoura
  async function enviarPorEmail() {
    const { lavouraId, usuarioId } = obterIds();

    if (!lavouraId) {
      toast.erro("Não foi possível identificar a lavoura.");
      return;
    }

    setEnviandoEmail(true);

    try {
      const pdf = await gerarPdf();
      if (!pdf) throw new Error("Falha ao gerar o PDF");

      // datauristring vem como "data:application/pdf;filename=...;base64,XXXX"
      const pdfBase64 = pdf.output("datauristring").split(",").pop();

      const resp = await fetch(`${AUTH_API_URL}/laudo/enviar_email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lavouraId,
          usuarioId,
          pdfBase64,
          nomeArquivo: nomeArquivoPdf(),
        }),
      });

      const dados = await resp.json();

      if (!resp.ok) {
        throw new Error(dados.mensagem || "Erro ao enviar e-mail");
      }

      toast.sucesso(`Laudo enviado com sucesso para ${dados.email}.`, 7000);
    } catch (erro) {
      console.error("Erro ao enviar laudo por e-mail:", erro);
      toast.erro("Não foi possível enviar o laudo por e-mail. Tente novamente.");
    } finally {
      setEnviandoEmail(false);
    }
  }

  return (
    <div className="ui-coluna ui-coluna--larga ui-coluna--sem-nav">
      <AppBar titulo="Laudo técnico" subtitulo={lavouraNome} para="/home" />

      <main className="ui-conteudo">
        <div className="laudo-card">
          <div ref={conteudoRef} className="laudo-conteudo">
            {/* CABEÇALHO */}
            <header className="laudo-header">
              <div className="laudo-header-text">
                <h2>Laudo Técnico</h2>
                <p>Relatório técnico de análise da lavoura</p>
              </div>

              <div className="laudo-icon">
                <img src={logoIcone} alt="CoffeeVision" />
              </div>
            </header>

            {/* INFORMAÇÕES DA LAVOURA */}
            <section className="laudo-section">
              <h3 className="laudo-section-title">Informações da Lavoura</h3>

              <div className="laudo-info-grid">
                <div className="laudo-field">
                  <span className="laudo-label">Produtor</span>
                  <span className="laudo-valor">{produtorNome}</span>
                </div>

                <div className="laudo-field">
                  <span className="laudo-label">Identificação da Lavoura</span>
                  <span className="laudo-valor">{lavouraNome}</span>
                </div>

                <div className="laudo-field">
                  <label className="laudo-label" htmlFor="laudo-data">
                    Data da análise
                  </label>

                  <input
                    id="laudo-data"
                    type="date"
                    value={dataAnalise}
                    onChange={(e) => setDataAnalise(e.target.value)}
                  />
                </div>
              </div>
            </section>

            {/* DIAGNÓSTICO */}
            <section className="laudo-section">
              <h3 className="laudo-section-title">Diagnóstico</h3>

              <div className="laudo-diagnostico">
                <p>
                  Registre abaixo a interpretação da visita técnica nas observações e as
                  orientações para o produtor nas recomendações.
                </p>
              </div>
            </section>

            {/* OBSERVAÇÕES */}
            <section className="laudo-section">
              <h3 className="laudo-section-title">Observações Técnicas</h3>

              <div className="laudo-field">
                <CampoLongo
                  rotulo="Observações técnicas"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Descreva as observações realizadas na lavoura..."
                />
              </div>
            </section>

            {/* RECOMENDAÇÕES */}
            <section className="laudo-section">
              <h3 className="laudo-section-title">Recomendações Técnicas</h3>

              <div className="laudo-field">
                <CampoLongo
                  rotulo="Recomendações técnicas"
                  value={recomendacoes}
                  onChange={(e) => setRecomendacoes(e.target.value)}
                  placeholder="Informe as recomendações para o produtor..."
                />
              </div>
            </section>
          </div>
          {/* fim do laudo-conteudo (o que vira PDF) */}
        </div>
      </main>

      {/* BOTÕES */}
      <div className="laudo-barra">
        <div className="laudo-actions">
          <Button
            variant="secondary"
            icon="baixar"
            onClick={baixarPdf}
            loading={gerandoPdf}
            disabled={enviandoEmail}
          >
            {gerandoPdf ? "Gerando PDF..." : "Baixar PDF"}
          </Button>

          <Button
            icon="email"
            onClick={enviarPorEmail}
            loading={enviandoEmail}
            disabled={gerandoPdf}
          >
            {enviandoEmail ? "Enviando..." : "Enviar por e-mail"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default Laudo;