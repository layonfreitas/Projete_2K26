import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import logoCoffeeVision from "../assets/logo-coffeevision.png";
import { AUTH_API_URL } from "../config/api";
import "./laudo.css";

function Laudo() {
    const navigate = useNavigate();
    const { id } = useParams();

    // Referência só do CONTEÚDO do laudo (sem os botões de ação),
    // é o que vira imagem/PDF.
    const conteudoRef = useRef(null);

    const [gerandoPdf, setGerandoPdf] = useState(false);
    const [enviandoEmail, setEnviandoEmail] = useState(false);
    const [mensagemEnvio, setMensagemEnvio] = useState(null);

    const [observacoes, setObservacoes] = useState("");
    const [recomendacoes, setRecomendacoes] = useState("");

    const [indicesPorData, setIndicesPorData] = useState({});
    const [erroIndices, setErroIndices] = useState(null);
    const [carregandoIndices, setCarregandoIndices] = useState(true);

    // Datas únicas do JSON, ordenadas da mais recente para a mais antiga.
    const [datasDisponiveis, setDatasDisponiveis] = useState([]);
    const [dataSelecionada, setDataSelecionada] = useState(null);

    const produtorNome =
        localStorage.getItem("produtorSelecionadoNome") ||
        "Nome do produtor";

    const lavouraNome =
        localStorage.getItem("lavouraNome") ||
        "Lavoura não selecionada";

    function obterIds() {
        const lavouraId = id || localStorage.getItem("lavouraId");

        const usuarioTipo = localStorage.getItem("usuarioTipo");
        const usuarioId =
            usuarioTipo === "agronomo"
                ? localStorage.getItem("produtorSelecionadoId")
                : localStorage.getItem("usuarioId");

        return { lavouraId, usuarioId };
    }

    const lavouraIdConsulta = id || localStorage.getItem("lavouraId");

    // A API deve retornar uma lista de { dataReferencia, tipoIndice, valor }.
    // Uma única consulta traz os valores; a seleção de data filtra localmente.
    useEffect(() => {
        const controller = new AbortController();
        setIndicesPorData({});
        setDatasDisponiveis([]);
        setDataSelecionada(null);
        setErroIndices(null);
        setCarregandoIndices(true);

        if (!lavouraIdConsulta) {
            setErroIndices("Não foi possível identificar a lavoura.");
            setCarregandoIndices(false);
            return () => controller.abort();
        }

        async function carregarIndices() {
            try {
                // Se o JSON vier de outra rota, altere somente esta URL.
                const resp = await fetch(
                    `${AUTH_API_URL}/indices_vegetacao/${encodeURIComponent(lavouraIdConsulta)}`,
                    { signal: controller.signal }
                );

                if (!resp.ok) {
                    throw new Error(`Erro ao consultar índices (HTTP ${resp.status}).`);
                }

                const dados = await resp.json();
                if (!Array.isArray(dados)) {
                    throw new Error("A API deve retornar uma lista de índices.");
                }

                const agrupados = {};
                const tiposAceitos = ["NDVI", "NDRE", "NDWI"];

                for (const item of dados) {
                    if (!item || typeof item !== "object") continue;

                    const data = item.dataReferencia;
                    const tipo = typeof item.tipoIndice === "string"
                        ? item.tipoIndice.trim().toUpperCase()
                        : "";

                    if (
                        typeof data !== "string" ||
                        !/^\d{4}-\d{2}-\d{2}$/.test(data) ||
                        !tiposAceitos.includes(tipo)
                    ) continue;

                    // Mantém zero e números negativos; não converte null em zero.
                    const valor = typeof item.valor === "number" && Number.isFinite(item.valor)
                        ? item.valor
                        : null;

                    if (!agrupados[data]) agrupados[data] = {};
                    agrupados[data][tipo] = valor;
                }

                const datas = Object.keys(agrupados).sort().reverse();
                if (controller.signal.aborted) return;

                setIndicesPorData(agrupados);
                setDatasDisponiveis(datas);
                setDataSelecionada(datas[0] || null);
            } catch (erro) {
                if (controller.signal.aborted) return;
                console.error("Erro ao carregar índices:", erro);
                setErroIndices(erro.message || "Não foi possível carregar os índices.");
            } finally {
                if (!controller.signal.aborted) setCarregandoIndices(false);
            }
        }

        carregarIndices();
        return () => controller.abort();
    }, [lavouraIdConsulta]);

    const indices = indicesPorData[dataSelecionada] || {};

    const formatarIndice = (valor) => {
        if (carregandoIndices) return "...";
        if (!Number.isFinite(valor)) return "--";
        return valor.toFixed(6);
    };

    const formatarDataExibicao = (dataIso) => {
        if (!dataIso) return "";
        const [ano, mes, dia] = dataIso.split("-");
        return `${dia}/${mes}/${ano}`;
    };

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
        setMensagemEnvio(null);
        try {
            const pdf = await gerarPdf();
            if (pdf) pdf.save(nomeArquivoPdf());
        } catch (erro) {
            console.error("Erro ao gerar PDF:", erro);
            setMensagemEnvio("Não foi possível gerar o PDF.");
        } finally {
            setGerandoPdf(false);
        }
    }

    // Gera o PDF e manda pro backend enviar por e-mail ao produtor
    // dono da lavoura
    async function enviarPorEmail() {
        const { lavouraId, usuarioId } = obterIds();

        if (!lavouraId) {
            setMensagemEnvio("Não foi possível identificar a lavoura.");
            return;
        }

        setEnviandoEmail(true);
        setMensagemEnvio(null);

        try {
            const pdf = await gerarPdf();
            if (!pdf) throw new Error("Falha ao gerar o PDF");

            // datauristring vem como "data:application/pdf;filename=...;base64,XXXX"
            const pdfBase64 = pdf
                .output("datauristring")
                .split(",")
                .pop();

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

            setMensagemEnvio(
                `Laudo enviado com sucesso para ${dados.email}.`
            );
        } catch (erro) {
            console.error("Erro ao enviar laudo por e-mail:", erro);
            setMensagemEnvio(
                "Não foi possível enviar o laudo por e-mail. Tente novamente."
            );
        } finally {
            setEnviandoEmail(false);
        }
    }

    return (
        <div className="laudo-page">

            <div className="laudo-card">

              <div ref={conteudoRef} className="laudo-conteudo">

                {/* CABEÇALHO */}
                <header className="laudo-header">

                    <div className="laudo-header-text">

                        <h1>Laudo Técnico</h1>

                        <p>
                            Relatório técnico de análise da lavoura
                        </p>

                    </div>

                    <div className="laudo-icon">

                        <img
                            src={logoCoffeeVision}
                            alt="CoffeeVision"
                        />

                    </div>

                </header>


                {/* INFORMAÇÕES DA LAVOURA */}
                <section className="laudo-section">

                    <h2 className="laudo-section-title">
                        Informações da Lavoura
                    </h2>

                    <div className="laudo-info-grid">

                        <div className="laudo-field">

                            <label>
                                Produtor
                            </label>

                            <span>
                                {produtorNome}
                            </span>

                        </div>


                        <div className="laudo-field">

                            <label>
                                Identificação da Lavoura
                            </label>

                            <span>
                                {lavouraNome}
                            </span>

                        </div>


                        <div className="laudo-field">

                            <label>
                                Data da análise
                            </label>

                            {datasDisponiveis.length > 1 ? (
                                <select
                                    value={dataSelecionada || ""}
                                    onChange={(e) =>
                                        setDataSelecionada(e.target.value)
                                    }
                                >
                                    {datasDisponiveis.map((data) => (
                                        <option key={data} value={data}>
                                            {formatarDataExibicao(data)}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <span>
                                    {dataSelecionada
                                        ? formatarDataExibicao(dataSelecionada)
                                        : carregandoIndices
                                            ? "Carregando análises..."
                                            : erroIndices
                                                ? "Análises indisponíveis"
                                                : "Nenhuma análise encontrada"}
                                </span>
                            )}

                        </div>

                    </div>

                </section>


                {/* DIAGNÓSTICO */}
                <section className="laudo-section">

                    <h2 className="laudo-section-title">
                        Diagnóstico
                    </h2>

                    <div className="laudo-diagnostico">

                        <div className="laudo-diagnostico-header">

                            <span className="laudo-diagnostico-title">
                                Resultado da análise
                            </span>

                            <span className="laudo-status">
                                {carregandoIndices
                                    ? "Carregando análise..."
                                    : erroIndices
                                        ? "Erro ao carregar análise"
                                        : dataSelecionada
                                            ? "Índices carregados"
                                            : "Sem análise disponível"}
                            </span>

                        </div>

                        <p>
                            Os índices disponíveis são apresentados abaixo.
                            Registre a interpretação da análise nas observações
                            técnicas e as orientações nas recomendações.
                        </p>

                    </div>

                </section>


                {/* RESULTADOS */}
                <section className="laudo-section">

                    <h2 className="laudo-section-title">
                        Indicadores da Lavoura
                    </h2>

                    {erroIndices && <p role="alert">{erroIndices}</p>}

                    <div className="laudo-resultados">

                        <div className="laudo-result-card">

                            <span className="laudo-result-label">
                                NDVI
                            </span>
                            <span className="laudo-result-value">
                                {formatarIndice(indices.NDVI)}
                            </span>

                        </div>


                        <div className="laudo-result-card">

                            <span className="laudo-result-label">
                                NDRE
                            </span>

                            <span className="laudo-result-value">
                                {formatarIndice(indices.NDRE)}
                            </span>

                        </div>


                        <div className="laudo-result-card">

                            <span className="laudo-result-label">
                                NDWI
                            </span>

                            <span className="laudo-result-value">
                                {formatarIndice(indices.NDWI)}
                            </span>

                        </div>

                    </div>

                </section>


                {/* OBSERVAÇÕES */}
                <section className="laudo-section">

                    <h2 className="laudo-section-title">
                        Observações Técnicas
                    </h2>

                    <div className="laudo-field">

                        <textarea
                            value={observacoes}
                            onChange={(e) =>
                                setObservacoes(e.target.value)
                            }
                            placeholder="Descreva as observações realizadas na lavoura..."
                        />

                    </div>

                </section>


                {/* RECOMENDAÇÕES */}
                <section className="laudo-section">

                    <h2 className="laudo-section-title">
                        Recomendações Técnicas
                    </h2>

                    <div className="laudo-field">

                        <textarea
                            value={recomendacoes}
                            onChange={(e) =>
                                setRecomendacoes(e.target.value)
                            }
                            placeholder="Informe as recomendações para o produtor..."
                        />

                    </div>

                </section>

              </div>
              {/* fim do laudo-conteudo (o que vira PDF) */}


                {mensagemEnvio && (
                    <p className="laudo-mensagem-envio">
                        {mensagemEnvio}
                    </p>
                )}

                {/* BOTÕES */}
                <div className="laudo-actions">

                    <button
                        className="laudo-btn"
                        onClick={() => navigate(-1)}
                    >
                        Voltar
                    </button>

                    <button
                        className="laudo-btn"
                        type="button"
                        onClick={baixarPdf}
                        disabled={gerandoPdf}
                    >
                        {gerandoPdf ? "Gerando PDF..." : "Baixar PDF"}
                    </button>

                    <button
                        className="laudo-btn"
                        type="button"
                        onClick={enviarPorEmail}
                        disabled={enviandoEmail}
                    >
                        {enviandoEmail
                            ? "Enviando..."
                            : "Enviar por E-mail"}
                    </button>

                </div>

            </div>

        </div>
    );
}

export default Laudo;