import "./UploadCard.css";

function UploadCard({
  imagem,
  carregando,
  handleImagem,
  handleAnalisar
}) {
  return (
    <section className="upload-card">

      <div className="titulo-upload">
        <h3>Nova análise</h3>
        <p>Envie uma foto da folha do cafeeiro para identificar possíveis doenças.</p>
      </div>

      {!imagem && (
        <div className="preview-vazio">

          <div className="icone">
            🌿
          </div>

          <h4>Nenhuma imagem selecionada</h4>

          <span>
            Escolha uma foto nítida da folha.
          </span>

        </div>
      )}

      {imagem && (
        <div className="preview">

          <img
            src={imagem}
            alt="Folha selecionada"
          />

        </div>
      )}

      {/* NÃO ALTERAR ESSA LÓGICA */}

      <input
        type="file"
        accept="image/*"
        onChange={handleImagem}
        hidden
        id="upload"
      />

      <div className="botoes">

        <label
          htmlFor="upload"
          className="botao-upload"
        >
          📷 Escolher imagem
        </label>

        {imagem && (

          <button
            onClick={handleAnalisar}
            disabled={carregando}
          >
            {carregando
              ? "Analisando..."
              : "🔍 Analisar imagem"}
          </button>

        )}

      </div>

    </section>
  );
}

export default UploadCard;