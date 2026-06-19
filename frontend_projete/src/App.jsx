import { useState } from 'react';

function App() {
  const [imagem, setImagem] = useState(null);

  const handleImagem = (event) => {
    const arquivo = event.target.files[0];

    if (arquivo) {
      setImagem(URL.createObjectURL(arquivo));
    }
  };

  return (
    <div>
      <h1>Seja bem vindo ao Coffee Vision</h1>


      <h2>Escolha uma imagem</h2>

      <input
        type="file"
        accept="image/*"
        onChange={handleImagem}
      />

      {imagem && (
        <div>
          <img
            src={imagem}
            alt="Imagem escolhida"
            width="300"
          />
        </div>
      )}
    </div>
  );
}

export default App;