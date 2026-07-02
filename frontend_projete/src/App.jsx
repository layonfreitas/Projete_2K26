import { useState } from "react";
import "./App.css";

import { analisarImagem } from "./services/FrontendAPI";

import Header from "./components/Header";
import UploadCard from "./components/UploadCard";
import ResultCard from "./components/ResultCard";
import QuickActions from "./components/QuickActions";
import BottomNav from "./components/BottomNav";

function App() {

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

  return (

    <div className="app">

      <Header />

      <main className="conteudo">

        <UploadCard

          imagem={imagem}

          carregando={carregando}

          handleImagem={handleImagem}

          handleAnalisar={handleAnalisar}

        />

        {resultado &&

          <ResultCard

            resultado={resultado}

          />

        }

        <QuickActions />

      </main>

      <BottomNav />

    </div>

  );
}

export default App;