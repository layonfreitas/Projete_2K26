import { useState, useLayoutEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { criarLaudoPdf, nomeArquivoLaudo } from "../services/relatoriosPdf";
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



  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [enviandoEmail, setEnviandoEmail] = useState(false);

  const [resumo, setResumo] = useState("");
  const [dataImagem, setDataImagem] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [mapa, setMapa] = useState(null);
  const [legendaMapa, setLegendaMapa] = useState("");
  const [carregandoMapa, setCarregandoMapa] = useState(false);
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

  async function carregarImagem(url) {
    const imagem = new Image();
    imagem.src = url;
    await imagem.decode();
    const canvas = document.createElement("canvas");
    const escala = Math.min(1, 1800 / Math.max(imagem.width, imagem.height));
    canvas.width = Math.round(imagem.width * escala);
    canvas.height = Math.round(imagem.height * escala);
    const contexto = canvas.getContext("2d");
    contexto.fillStyle = "#ffffff";
    contexto.fillRect(0, 0, canvas.width, canvas.height);
    contexto.drawImage(imagem, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.92);
  }

  async function anexarMapa(evento) {
    const arquivo = evento.target.files?.[0];
    if (!arquivo) return;
    evento.target.value = "";
    if (!["image/png", "image/jpeg"].includes(arquivo.type) || arquivo.size > 10 * 1024 * 1024) {
      toast.erro("Escolha uma imagem PNG ou JPEG de até 10 MB.");
      return;
    }
    setCarregandoMapa(true);
    const url = URL.createObjectURL(arquivo);
    try {
      setMapa(await carregarImagem(url));
    } catch {
      toast.erro("Não foi possível abrir a imagem do mapa.");
    } finally {
      URL.revokeObjectURL(url);
      setCarregandoMapa(false);
    }
  }

  async function gerarPdf() {
    const logo = await carregarImagem(logoIcone);
    return criarLaudoPdf({ produtorNome, lavouraNome, dataSelecionada: dataAnalise,
      dataImagem, resumo, observacoes, recomendacoes, responsavel,
      logo, mapa, legendaMapa });
  }

  function nomeArquivoPdf() {
    return nomeArquivoLaudo(lavouraNome);
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
          <div className="laudo-conteudo">
            {/* CABEÇALHO */}
            <header className="laudo-header">
              <div className="laudo-header-text">
                <span className="laudo-marca">COFFEEVISION • ACOMPANHAMENTO</span>
                <h2>Laudo da lavoura</h2>
                <p>Observações e orientações claras para o produtor.</p>
              </div>

              <div className="laudo-icon">
                <img src={logoIcone} alt="CoffeeVision" />
              </div>
            </header>

            {/* INFORMAÇÕES DA LAVOURA */}
            <section className="laudo-section">
              <h3 className="laudo-section-title">01 · Identificação</h3>

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
                <div className="laudo-field">
                  <label className="laudo-label" htmlFor="laudo-imagem-data">Data da imagem (opcional)</label>
                  <input id="laudo-imagem-data" type="date" value={dataImagem} onChange={(e) => setDataImagem(e.target.value)} />
                  <small>Preencha com a data de captura, quando utilizar um mapa.</small>
                </div>
                <div className="laudo-field">
                  <label className="laudo-label" htmlFor="laudo-responsavel">Responsável pela análise</label>
                  <input id="laudo-responsavel" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Nome e registro profissional, se aplicável" />
                </div>
                <div className="laudo-field">
                  <span className="laudo-label">Data de emissão</span>
                  <span className="laudo-valor">Registrada automaticamente ao gerar o PDF.</span>
                </div>
              </div>
            </section>

            {/* DIAGNÓSTICO */}
            <section className="laudo-section">
              <h3 className="laudo-section-title">02 · Resumo da análise</h3>

              <div className="laudo-field">
                <CampoLongo rotulo="Resumo da análise" value={resumo} onChange={(e) => setResumo(e.target.value)} placeholder="Explique a situação observada e quais áreas precisam de atenção. Se a análise não estiver disponível, informe aqui." />
              </div>
            </section>

            <section className="laudo-section">
              <h3 className="laudo-section-title">Mapa de referência (opcional)</h3>
              <div className="laudo-field">
                <label className="laudo-label" htmlFor="laudo-mapa">Anexar mapa em PNG ou JPEG · até 10 MB</label>
                <input id="laudo-mapa" type="file" accept="image/png,image/jpeg" onChange={anexarMapa} disabled={carregandoMapa || gerandoPdf || enviandoEmail} />
                {carregandoMapa && <p role="status">Preparando mapa...</p>}
                {mapa && <>
                  <img className="laudo-mapa" src={mapa} alt="Mapa anexado ao laudo" />
                  <label className="laudo-label" htmlFor="laudo-legenda">Legenda do mapa</label>
                  <input id="laudo-legenda" value={legendaMapa} onChange={(e) => setLegendaMapa(e.target.value)} placeholder="Explique as cores e as áreas sinalizadas." />
                  <button type="button" className="laudo-remover" onClick={() => { setMapa(null); setLegendaMapa(""); }}>Remover mapa</button>
                </>}
              </div>
            </section>

            {/* OBSERVAÇÕES */}
            <section className="laudo-section">
              <h3 className="laudo-section-title">03 · Observações em campo</h3>

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
              <h3 className="laudo-section-title">04 · Orientações ao produtor</h3>

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
            disabled={enviandoEmail || carregandoMapa}
          >
            {gerandoPdf ? "Gerando PDF..." : "Baixar PDF"}
          </Button>

          <Button
            icon="email"
            onClick={enviarPorEmail}
            loading={enviandoEmail}
            disabled={gerandoPdf || carregandoMapa}
          >
            {enviandoEmail ? "Enviando..." : "Enviar por e-mail"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default Laudo;