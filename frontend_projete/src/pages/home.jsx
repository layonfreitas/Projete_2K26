import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../App.css";

import { analisarImagem } from "../services/FrontendAPI";

import Header from "../components/Header";
import UploadCard from "../components/UploadCard";
import ResultCard from "../components/ResultCard";
import BottomNav from "../components/BottomNav";
import ClimaCard from "../components/ClimaCard";

function Home() {
  const navigate = useNavigate();

  const [imagem, setImagem] = useState(null);
  const [arquivo, setArquivo] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [carregando, setCarregando] = useState(false);

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
          <ClimaCard />
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