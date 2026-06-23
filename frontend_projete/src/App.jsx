import { useState } from 'react';
import { analisarImagem } from './services/FrontendAPI.js';

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
    <div>
      <h1>Seja bem vindo ao Coffee Vision</h1>
      <h2>Escolha uma imagem</h2>

      <input type="file" accept="image/*" onChange={handleImagem} hidden id="upload" />
      <label htmlFor="upload" className="upload-button">Escolher imagem</label>


      {imagem && (
  <button onClick={handleAnalisar} disabled={carregando}>
    {carregando ? 'Analisando...' : 'Analisar imagem'}
  </button>
)}

      {imagem && (
        <div>
          <img id="imagem-selecionada" src={imagem} alt="Imagem escolhida" width="300" />
        </div>
      )}

     {resultado && (
  <div>
    <h3>Resultado:</h3>
    {resultado.resultado.length === 0 
      ? <p>Nenhuma doença detectada</p>
      : resultado.resultado.map((doenca, index) => (
          <p key={index}>{doenca}</p>
        ))
    }
  </div>
)}
    </div>
  );
}

export default App;