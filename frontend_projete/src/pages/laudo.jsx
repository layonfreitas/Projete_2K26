import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import logoCoffeeVision from "../assets/logo-coffeevision.png";
import { AUTH_API_URL } from "../config/api";
import "./laudo.css";

function Laudo() {
    const navigate = useNavigate();
    const { id } = useParams();

    const [observacoes, setObservacoes] = useState("");
    const [recomendacoes, setRecomendacoes] = useState("");

    const [indices, setIndices] = useState({});
    const [carregandoIndices, setCarregandoIndices] = useState(true);

    const produtorNome =
        localStorage.getItem("produtorSelecionadoNome") ||
        "Nome do produtor";

    const lavouraNome =
        localStorage.getItem("lavouraNome") ||
        "Lavoura não selecionada";

    // =========================================================
    // BUSCAR OS VALORES REAIS DOS ÍNDICES (NDVI, NDRE, NDWI)
    // =========================================================
    useEffect(() => {
        const lavouraId = id || localStorage.getItem("lavouraId");

        const usuarioTipo = localStorage.getItem("usuarioTipo");
        const usuarioId =
            usuarioTipo === "agronomo"
                ? localStorage.getItem("produtorSelecionadoId")
                : localStorage.getItem("usuarioId");

        if (!lavouraId || !usuarioId) {
            setCarregandoIndices(false);
            return;
        }

        async function carregarIndices() {
            try {
                // 1) descobre a data mais recente com imagens processadas
                const respImagens = await fetch(
                    `${AUTH_API_URL}/imagens/${lavouraId}?usuario_id=${usuarioId}`
                );
                const imagens = await respImagens.json();

                if (!respImagens.ok || !imagens.length) {
                    setCarregandoIndices(false);
                    return;
                }

                const dataMaisRecente = imagens[0].data;

                // 2) busca o valor de cada índice para essa data
                const nomesIndices = ["NDVI", "NDRE", "NDWI"];

                const resultados = await Promise.all(
                    nomesIndices.map(async (nome) => {
                        try {
                            const resp = await fetch(
                                `${AUTH_API_URL}/acessar_imagem?id=${lavouraId}` +
                                `&usuario_id=${usuarioId}` +
                                `&data=${dataMaisRecente}` +
                                `&indice=${nome}`
                            );
                            const dados = await resp.json();
                            return [nome, resp.ok ? dados.valor_indice : null];
                        } catch {
                            return [nome, null];
                        }
                    })
                );

                setIndices(Object.fromEntries(resultados));
            } catch (erro) {
                console.error("Erro ao carregar índices:", erro);
            } finally {
                setCarregandoIndices(false);
            }
        }

        carregarIndices();
    }, [id]);

    const formatarIndice = (valor) => {
        if (valor === null || valor === undefined) {
            return carregandoIndices ? "..." : "--";
        }
        return Number(valor).toFixed(2);
    };

    const gerarLaudo = () => {
        window.print();
    };

    return (
        <div className="laudo-page">

            <div className="laudo-card">

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

                            <input
                                type="date"
                            />

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
                                Análise concluída
                            </span>

                        </div>

                        <p>
                            Com base na análise realizada, foram
                            identificados indícios de alterações na
                            saúde da lavoura. Recomenda-se a avaliação
                            das condições apresentadas e o
                            acompanhamento periódico da área.
                        </p>

                    </div>

                </section>


                {/* RESULTADOS */}
                <section className="laudo-section">

                    <h2 className="laudo-section-title">
                        Indicadores da Lavoura
                    </h2>

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
                        type="button" onClick={gerarLaudo}
                    >
                        Gerar Laudo
                    </button>

                </div>

            </div>

        </div>
    );
}

export default Laudo;