import { useState , useEffect} from "react";
import { useNavigate } from "react-router-dom";
import "../App.css";
import Clima from "../dados_clima";

import { analisarImagem } from "../services/FrontendAPI";

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
  const [lavoura, setLavoura] = useState(null);

  useEffect(() => {
  async function buscarLavouras() {
    const usuarioId = localStorage.getItem("usuarioId");
    if (!usuarioId) return;

    try {
      const resposta = await fetch(
        `http://localhost:5000/lavouras/${usuarioId}`
      );
      const dados = await resposta.json();

      if (resposta.ok && dados.length > 0) {
        setLavoura(dados[0]);
      }
    } catch (erro) {
      console.error("Erro ao buscar lavouras:", erro);
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
  {lavoura && lavoura.coordenadas && lavoura.coordenadas.length > 0 && (
  <Clima
    latitude={lavoura.coordenadas[0].lat}
    longitude={lavoura.coordenadas[0].lng}
  />
)}

        <UploadCard
          imagem={imagem}
          carregando={carregando}
          handleImagem={handleImagem}
          handleAnalisar={handleAnalisar}
        />

        {resultado && <ResultCard resultado={resultado} />}

        
      </main>

      <BottomNav />
    </div>
  );
}

export default Home;