import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./home.css";

import ClimaBanner from "../components/ClimaBanner";
import Header from "../components/Header";
import UploadCard from "../components/UploadCard";
import ResultCard from "../components/ResultCard";
import AvisosBanner from "../components/AvisosBanner";
import BottomNav from "../components/BottomNav";
import Button from "../components/ui/Button";
import { EmptyState, ErrorState, Skeleton } from "../components/ui/States";

import { analisarImagem } from "../services/FrontendAPI";
import { mensagemDeErro } from "../services/erros";
import { AUTH_API_URL } from "../config/api";
import { useToast } from "../components/ui/toastContext";

function Home() {
  const navigate = useNavigate();
  const toast = useToast();

  const [imagem, setImagem] = useState(null);
  const [arquivo, setArquivo] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [carregando, setCarregando] = useState(false);

  const [tentativa, setTentativa] = useState(0);
  const [consulta, setConsulta] = useState({ chave: "", lavouras: [], erro: "" });

  const usuarioTipo = localStorage.getItem("usuarioTipo");
  const usuarioId = localStorage.getItem("usuarioId");
  const produtorSelecionadoId = localStorage.getItem("produtorSelecionadoId");

  // O agrônomo vê as lavouras do produtor que escolheu; o produtor, as suas.
  const idParaBuscar = usuarioTipo === "agronomo" ? produtorSelecionadoId : usuarioId;
  const chave = idParaBuscar ? `${idParaBuscar}:${tentativa}` : "";

  useEffect(() => {
    if (!chave) return undefined;

    let cancelado = false;

    async function buscarLavouras() {
      try {
        const resposta = await fetch(`${AUTH_API_URL}/lavouras/${idParaBuscar}`);
        const dados = await resposta.json();

        if (!resposta.ok) {
          throw new Error(dados.mensagem || "Não foi possível carregar as lavouras.");
        }

        if (!cancelado) {
          setConsulta({ chave, lavouras: Array.isArray(dados) ? dados : [], erro: "" });
        }
      } catch (erro) {
        if (!cancelado) {
          setConsulta({
            chave,
            lavouras: [],
            erro: mensagemDeErro(erro, "Não foi possível carregar as lavouras."),
          });
        }
      }
    }

    buscarLavouras();

    return () => {
      cancelado = true;
    };
  }, [chave, idParaBuscar]);

  const carregandoLavouras = Boolean(chave) && consulta.chave !== chave;
  const lavouras = consulta.chave === chave ? consulta.lavouras : [];
  const erroLavouras = consulta.chave === chave ? consulta.erro : "";
  const semLavouras =
    Boolean(chave) && !carregandoLavouras && !erroLavouras && lavouras.length === 0;
  const semProdutor = usuarioTipo === "agronomo" && !produtorSelecionadoId;

  const handleImagem = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (imagem) URL.revokeObjectURL(imagem);
      setArquivo(file);
      setImagem(URL.createObjectURL(file));
      setResultado(null);
    }
  };

  const handleAnalisar = async () => {
    setCarregando(true);
    try {
      const data = await analisarImagem(arquivo);
      setResultado(data);
    } catch {
      toast.erro("Não foi possível analisar a imagem agora. Verifique a conexão e tente de novo.");
    } finally {
      setCarregando(false);
    }
  };

  const limparImagem = () => {
    if (imagem) URL.revokeObjectURL(imagem);
    setImagem(null);
    setArquivo(null);
    setResultado(null);
  };

  return (
    <div className="home">
      <Header />

      <main className="home-conteudo">
        <AvisosBanner />

        {semProdutor && (
          <EmptyState
            className="home-largo"
            icone="usuarios"
            titulo="Escolha um produtor"
            texto="Selecione o produtor que você vai acompanhar para ver o clima e as lavouras dele."
          >
            <Button icon="usuarios" onClick={() => navigate("/agronomo")}>
              Ver meus produtores
            </Button>
          </EmptyState>
        )}

        {carregandoLavouras && (
          <div className="home-largo" aria-busy="true">
            <Skeleton linhas={1} altura={280} />
          </div>
        )}

        {erroLavouras && (
          <div className="home-largo">
            <ErrorState mensagem={erroLavouras} aoTentar={() => setTentativa((n) => n + 1)} />
          </div>
        )}

        {lavouras.length > 0 && <ClimaBanner lavouras={lavouras} />}

        {usuarioTipo !== "agronomo" && (
          <UploadCard
            imagem={imagem}
            carregando={carregando}
            handleImagem={handleImagem}
            handleAnalisar={handleAnalisar}
            onLimpar={limparImagem}
            nomeArquivo={arquivo?.name}
          />
        )}

        {semLavouras && (
          <EmptyState
            className="home-largo"
            icone="broto"
            titulo="Nenhuma lavoura cadastrada"
            texto={
              usuarioTipo === "agronomo"
                ? "Este produtor ainda não possui nenhuma lavoura cadastrada no sistema."
                : "Desenhe o contorno da sua lavoura no mapa para acompanhar o clima e receber o apoio do seu agrônomo."
            }
          >
            {usuarioTipo !== "agronomo" && (
              <Button icon="mapa" onClick={() => navigate("/mapa")}>
                Cadastrar no mapa
              </Button>
            )}
          </EmptyState>
        )}

        {resultado && <ResultCard resultado={resultado} onNova={limparImagem} />}
      </main>

      <BottomNav />
    </div>
  );
}

export default Home;
