
import { useState, useEffect } from "react";
import { AUTH_API_URL } from "../config/api";

import {
    MapContainer,
    TileLayer,
    Marker,
    Polygon
} from "react-leaflet";

import { useParams, useNavigate } from "react-router-dom";

import "leaflet/dist/leaflet.css";
import "./edicao.css";

// ======================================================
// MARCADOR EDITÁVEL
// ======================================================

function PontoEditavel({ ponto, index, atualizarPonto, removerPonto }) {
    return (
        <Marker
            position={[ponto.lat, ponto.lng]}
            draggable={true}
            eventHandlers={{
                dragend: (evento) => {
                    const novaPosicao =
                        evento.target.getLatLng();

                    atualizarPonto(index, {
                        lat: novaPosicao.lat,
                        lng: novaPosicao.lng
                    });
                }
            }}
        />
    );
}

// ======================================================
// PÁGINA DE EDIÇÃO
// ======================================================

function Edicao() {

    const navigate = useNavigate();

    // ID vindo da URL
    // Exemplo: /edicao/5
    const { id } = useParams();

    const [coordenadas, setCoordenadas] = useState([]);
    const [modoEdicao, setModoEdicao] = useState(false);

    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");

    const [nomeLavoura, setNomeLavoura] = useState("");

    // ==================================================
    // BUSCAR LAVOURA NO BACKEND
    // ==================================================

    useEffect(() => {

        async function carregarLavoura() {

            try {

                setCarregando(true);
                setErro("");

                console.log("Buscando lavoura ID:", id);

                const resposta = await fetch(
                    `${AUTH_API_URL}/lavoura/${id}`
                );

                const dados = await resposta.json();

                console.log("Resposta do backend:", dados);

                if (!resposta.ok) {
                    throw new Error(
                        dados.mensagem || "Erro ao buscar lavoura."
                    );
                }

                // Guarda as coordenadas
                setCoordenadas(
                    dados.coordenadas || []
                );

                // Guarda o nome
                setNomeLavoura(
                    dados.nomeLavoura || ""
                );

                // Guarda também no localStorage
                localStorage.setItem(
                    "lavouraNome",
                    dados.nomeLavoura || ""
                );

            } catch (erro) {

                console.error(
                    "Erro ao carregar lavoura:",
                    erro
                );

                setErro(
                    erro.message ||
                    "Erro ao carregar lavoura."
                );

            } finally {

                setCarregando(false);

            }
        }

        if (id) {
            carregarLavoura();
        }

    }, [id]);

    // ==================================================
    // ATUALIZAR UM PONTO
    // ==================================================

    function atualizarPonto(index, novoPonto) {

        setCoordenadas((anteriores) =>
            anteriores.map((ponto, i) =>
                i === index
                    ? novoPonto
                    : ponto
            )
        );

    }

    

    // ==================================================
    // SALVAR PONTOS
    // ==================================================

    async function salvarPontos() {
         try {
        const resposta = await fetch(
            `${AUTH_API_URL}/lavoura/${id}`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    coordenadas: coordenadas
                })
            }
        );

        const dados = await resposta.json();

        if (!resposta.ok) {
            throw new Error(
                dados.mensagem || "Erro ao salvar coordenadas."
            );
        }

        alert("Coordenadas atualizadas com sucesso!");
        setModoEdicao(false);

    } catch (erro) {
        console.error("Erro ao salvar coordenadas:", erro);
        alert(erro.message);
    }

    }

    // ==================================================
    // SALVAR NOME
    // ==================================================

    async function salvarNome() {
    if (!nomeLavoura.trim()) {
        alert("Digite um nome para a lavoura.");
        return;
    }

    try {
        const resposta = await fetch(
            `${AUTH_API_URL}/lavoura/${id}`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    nomeLavoura: nomeLavoura.trim()
                })
            }
        );

        const dados = await resposta.json();

        if (!resposta.ok) {
            throw new Error(
                dados.mensagem || "Erro ao salvar nome."
            );
        }

        localStorage.setItem(
            "lavouraNome",
            nomeLavoura.trim()
        );

        alert("Nome da lavoura atualizado com sucesso!");

    } catch (erro) {
        console.error("Erro ao salvar nome:", erro);
        alert(erro.message);
    }
    }

    async function removerLavoura() {
         const confirmar = window.confirm(
        "Tem certeza que deseja remover esta lavoura? Essa ação não pode ser desfeita."
    );

    if (!confirmar) {
        return;
    }

    try {
        const resposta = await fetch(
            `${AUTH_API_URL}/lavoura/${id}`,
            {
                method: "DELETE"
            }
        );

        const dados = await resposta.json();

        if (!resposta.ok) {
            throw new Error(
                dados.mensagem || "Erro ao remover lavoura."
            );
        }

        localStorage.removeItem("lavouraId");
        localStorage.removeItem("lavouraNome");

        alert("Lavoura removida com sucesso!");

        navigate("/home");

    } catch (erro) {
        console.error("Erro ao remover lavoura:", erro);
        alert(erro.message);
    }
    }


    // ==================================================
    // CARREGANDO
    // ==================================================

    if (carregando) {

        return (
            <div className="editar-lavoura-page">

                <div className="editar-lavoura-card">

                    <p>
                        Carregando lavoura...
                    </p>

                </div>

            </div>
        );
    }

    // ==================================================
    // ERRO
    // ==================================================

    if (erro) {

        return (
            <div className="editar-lavoura-page">

                <div className="editar-lavoura-card">

                    <p>
                        {erro}
                    </p>

                    <button
                        className="editar-btn editar-btn-primary"
                        onClick={() => navigate(-1)}
                    >
                        Voltar
                    </button>

                </div>

            </div>
        );
    }

    // ==================================================
    // PÁGINA
    // ==================================================

    return (

        <div className="editar-lavoura-page">

            <div className="editar-lavoura-card">

                {/* ======================================
                    CABEÇALHO
                ====================================== */}

                <div className="editar-lavoura-header">

                    <h1>
                        Editar lavoura
                    </h1>

                    <p>
                        Altere as informações da sua lavoura.
                    </p>

                </div>

                {/* ======================================
                    ALTERAR NOME
                ====================================== */}

                <section className="editar-section">

                    <h2>
                        Nome da lavoura
                    </h2>

                    <p>
                        Altere o nome utilizado para
                        identificar esta lavoura.
                    </p>

                    <input
                        className="nome-lavoura-input"
                        type="text"
                        value={nomeLavoura}
                        onChange={(evento) =>
                            setNomeLavoura(
                                evento.target.value
                            )
                        }
                    />

                    <button
                        className="editar-btn editar-btn-primary"
                        onClick={salvarNome}
                    >
                        Salvar nome
                    </button>

                </section>

                {/* ======================================
                    EDITAR ÁREA
                ====================================== */}

                <section className="editar-section">

                    <h2>
                        Área da lavoura
                    </h2>

                    <p>
                        Edite os pontos do mapa para
                        ajustar os limites da lavoura.
                    </p>

                    {/* ==================================
                        MAPA
                    ================================== */}

                    <div className="mapa-edicao-container">

                        {coordenadas.length > 0 && (

                            <MapContainer
                                center={[
                                    coordenadas[0].lat,
                                    coordenadas[0].lng
                                ]}
                                zoom={16}
                                style={{
                                    width: "100%",
                                    height: "100%"
                                }}
                            >

                                <TileLayer
                                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                    attribution="Tiles © Esri"
                                />

                                {/* ==========================
                                    POLÍGONO
                                ========================== */}

                                <Polygon
                                    positions={
                                        coordenadas.map(
                                            (ponto) => [
                                                ponto.lat,
                                                ponto.lng
                                            ]
                                        )
                                    }
                                />

                                {/* ==========================
                                    MARCADORES
                                ========================== */}

                                {modoEdicao &&

                                    coordenadas.map(
                                        (ponto, index) => (

                                            <PontoEditavel
                                                key={index}
                                                ponto={ponto}
                                                index={index}
                                                atualizarPonto={
                                                    atualizarPonto
                                                }
                                            />

                                        )
                                    )

                                }

                            </MapContainer>

                        )}

                    </div>

                    {/* ==================================
                        AJUDA
                    ================================== */}

                    <p className="mapa-ajuda">

                        {modoEdicao
                            ? "Arraste os pontos para ajustar a área."
                            : "Clique em editar pontos para alterar a área."
                        }

                    </p>

                    {/* ==================================
                        BOTÃO EDITAR
                    ================================== */}

                    <button
                        className="editar-btn editar-pontos-btn"
                        onClick={() =>
                            setModoEdicao(!modoEdicao)
                        }
                    >

                        {modoEdicao
                            ? "Parar de editar"
                            : "Editar pontos"
                        }

                    </button>

                    {/* ==================================
                        BOTÃO SALVAR
                    ================================== */}

                    <button
                        className="editar-btn salvar-pontos-btn"
                        onClick={salvarPontos}
                    >
                        Salvar pontos
                    </button>

                </section>

                {/* ======================================
                    REMOVER
                ====================================== */}

                <section
                    className="editar-section editar-section-danger"
                >

                    <h2>
                        Remover lavoura
                    </h2>

                    <p>
                        A remoção da lavoura é permanente
                        e não poderá ser desfeita.
                    </p>

                    <button 
                        onClick={removerLavoura}
                    >
                        Remover lavoura
                    </button>

                </section>

            </div>

        </div>

    );
}

export default Edicao;
