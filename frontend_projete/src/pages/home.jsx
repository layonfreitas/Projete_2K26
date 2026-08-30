import { useState , useEffect} from "react";
import { useNavigate } from "react-router-dom";
import "../App.css";
import ClimaBanner from "../components/ClimaBanner";

import { analisarImagem } from "../services/FrontendAPI";
import { AUTH_API_URL } from "../config/api";

import Header from "../components/Header";
import UploadCard from "../components/UploadCard";
import ResultCard from "../components/ResultCard";
import BottomNav from "../components/BottomNav";

function Home() {
  const navigate = useNavigate();

  const [imagem, setImagem] = useState(null);
  const [arquivo, setArquivo] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [lavouras, setLavouras] = useState([]);
  const [semLavouras, setSemLavouras] = useState(false);

  const usuarioTipo = localStorage.getItem("usuarioTipo");

  useEffect(() => {
  async function buscarLavouras() {
    const usuarioId = localStorage.getItem("usuarioId");
    const produtorSelecionadoId = localStorage.getItem("produtorSelecionadoId");
          const idParaBuscar =
        usuarioTipo === "agronomo"
          ? produtorSelecionadoId
          : usuarioId;

      if (!idParaBuscar) return;

    try {
      const resposta = await fetch(
        `${AUTH_API_URL}/lavouras/${idParaBuscar}`
      );
      const dados = await resposta.json();

      if (resposta.ok) {
        if (dados.length === 0) {
          setSemLavouras(true);
        } else {
          setLavouras(dados);
          setSemLavouras(false);
        }
      }
    

    } catch (erro) {
      console.log("Erro ao buscar lavouras:", erro);
    }

  }

  buscarLavouras();
}, []);

  const handleImagem = (event) => {
    const file = event.target.files[0];
    if (file) {
      setArquivo(file);
      setImagem(URL.createObjectURL(file));
    }
  };

  const handleAnalisar = async () => {
    setCarregando(true);
    const data = await analisarImagem(arquivo);
    setResultado(data);
    setCarregando(false);
  };

  const handleSair = () => {
    localStorage.removeItem("autenticado");
    navigate("/login");
  };
  return (
    <div className="app">
      <Header aoSair={handleSair} />

      <main className="conteudo">
        <ClimaBanner lavouras={lavouras} />

        {usuarioTipo !== "agronomo" && (
         <UploadCard
          imagem={imagem}
          carregando={carregando}
          handleImagem={handleImagem}
          handleAnalisar={handleAnalisar} 
        />
        )}
        {semLavouras && (
    <div className="sem-lavouras">
    <div className="sem-lavouras-icone">
      🌱
    </div>

    <h2>Nenhuma lavoura cadastrada</h2>

    <p>
      Este produtor ainda não possui nenhuma lavoura cadastrada
      no sistema.
    </p>
    </div>
    

)}


        

{resultado && <ResultCard resultado={resultado} />}

        
      </main>

      <BottomNav />
    </div>
  );
}


export default Home;