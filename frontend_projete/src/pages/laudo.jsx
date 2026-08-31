import { useState } from "react";
import { useNavigate } from "react-router-dom";
import logoCoffeeVision from "../assets/logo-coffeevision.png";
import "./laudo.css";

function Laudo() {
    const navigate = useNavigate();

    const [observacoes, setObservacoes] = useState("");
    const [recomendacoes, setRecomendacoes] = useState("");
    const produtorNome = localStorage.getItem("produtorSelecionadoNome") || "Nome do produtor";

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
                        <img src={logoCoffeeVision} alt="CoffeeVision" />
                    </div>

                </header>


                {/* INFORMAÇÕES DA LAVOURA */}
                <section className="laudo-section">

                    <h2 className="laudo-section-title">
                        Informações da Lavoura
                    </h2>

                    <div className="laudo-info-grid">

                        <div className="laudo-field">
                            <label>Produtor</label>

                            <input
                                placeholder={`Nome do produtor: ${produtorNome}`}
                            />
                        </div>

                        <div className="laudo-field">
                            <label>Identificação da Lavoura</label>

                            <input
                                type="text"
                                placeholder="Nome da lavoura"
                            />
                        </div>

                        <div className="laudo-field">
                            <label>Área</label>

                            <input
                                type="text"
                                placeholder="Ex.: 2,5 hectares"
                            />
                        </div>

                        <div className="laudo-field">
                            <label>Data da análise</label>

                            <input
                                type="date"
                            />
                        </div>

                        <div className="laudo-field full">
                            <label>Localização</label>

                            <input
                                type="text"
                                placeholder="Coordenadas ou localização da lavoura"
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
                            Com base na análise realizada, foram identificados
                            indícios de alterações na saúde da lavoura.
                            Recomenda-se a avaliação das condições apresentadas
                            e o acompanhamento periódico da área.
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
                                0.72
                            </span>

                        </div>


                        <div className="laudo-result-card">

                            <span className="laudo-result-label">
                                NDRE
                            </span>

                            <span className="laudo-result-value">
                                0.54
                            </span>

                        </div>


                        <div className="laudo-result-card">

                            <span className="laudo-result-label">
                                NDWI
                            </span>

                            <span className="laudo-result-value">
                                0.61
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


                {/* ASSINATURAS */}
                <div className="laudo-assinatura">

                    <div className="laudo-assinatura-box">

                        <strong>
                            Responsável Técnico
                        </strong>

                        <span>
                            Engenheiro(a) Agrônomo(a)
                        </span>

                    </div>


                    <div className="laudo-assinatura-box">

                        <strong>
                            Produtor
                        </strong>

                        <span>
                            Assinatura do produtor
                        </span>

                    </div>

                </div>


                {/* BOTÕES */}
                <div className="laudo-actions">

                    <button
                        className="laudo-btn laudo-btn-secondary"
                        onClick={() => navigate(-1)}
                    >
                        Voltar
                    </button>


                    <button
                        className="laudo-btn laudo-btn-primary"
                        onClick={gerarLaudo}
                    >
                        Gerar Laudo
                    </button>

                </div>

            </div>

        </div>
    );
}

export default Laudo;