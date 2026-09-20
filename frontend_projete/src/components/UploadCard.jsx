import { useRef, useState } from "react";
import Icon from "./ui/Icon";
import Button from "./ui/Button";
import "./UploadCard.css";

const DICAS = [
  "Fotografe uma folha por vez, com boa luz natural.",
  "Deixe a folha inteira no enquadramento e em foco.",
  "Evite sombras fortes e fundos muito cheios.",
];

function UploadCard({ imagem, carregando, handleImagem, handleAnalisar, onLimpar, nomeArquivo }) {
  const inputRef = useRef(null);
  const [arrastando, setArrastando] = useState(false);

  function aoSoltar(evento) {
    evento.preventDefault();
    setArrastando(false);
    if (carregando) return;

    const arquivos = evento.dataTransfer?.files;
    if (arquivos?.length && arquivos[0].type.startsWith("image/")) {
      // mesmo formato do evento do <input>, para reaproveitar handleImagem
      handleImagem({ target: { files: arquivos } });
    }
  }

  function remover() {
    if (inputRef.current) inputRef.current.value = "";
    onLimpar?.();
  }

  return (
    <section className="upl-card" aria-labelledby="upl-titulo">
      <div className="upl-titulo">
        <h3 id="upl-titulo">Nova análise</h3>
        <p>Envie uma foto da folha do cafeeiro para identificar possíveis doenças.</p>
      </div>

      {/* NÃO ALTERAR ESSA LÓGICA */}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleImagem}
        hidden
        id="upload"
      />

      {!imagem && (
        <>
          <label
            htmlFor="upload"
            className={`upl-area ${arrastando ? "upl-area-ativa" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setArrastando(true);
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={aoSoltar}
          >
            <span className="upl-area-icone" aria-hidden="true">
              <Icon nome="camera" tamanho={28} />
            </span>
            <strong>Toque para escolher uma foto</strong>
            <span>ou arraste a imagem até aqui</span>
          </label>

          <ul className="upl-dicas" aria-label="Dicas para uma boa foto">
            {DICAS.map((dica) => (
              <li key={dica}>
                <Icon nome="lampada" tamanho={16} />
                {dica}
              </li>
            ))}
          </ul>
        </>
      )}

      {imagem && (
        <>
          <div className="upl-preview">
            <img src={imagem} alt="Folha selecionada para análise" />

            {carregando ? (
              <div className="upl-analisando" role="status">
                <span className="ui-spinner" aria-hidden="true" />
                Analisando a folha…
              </div>
            ) : (
              <button
                type="button"
                className="upl-remover"
                onClick={remover}
                aria-label="Remover imagem"
                title="Remover imagem"
              >
                <Icon nome="fechar" tamanho={18} />
              </button>
            )}
          </div>

          {nomeArquivo && <p className="upl-arquivo">{nomeArquivo}</p>}
        </>
      )}

      <div className="upl-botoes">
        {imagem && (
          <label
            htmlFor="upload"
            className="botao-upload upl-trocar"
            aria-disabled={carregando || undefined}
          >
            <Icon nome="imagem" tamanho={18} />
            Trocar imagem
          </label>
        )}

        {imagem && (
          <Button size="lg" icon="busca" onClick={handleAnalisar} loading={carregando}>
            {carregando ? "Analisando…" : "Analisar imagem"}
          </Button>
        )}

        {!imagem && (
          <label htmlFor="upload" className="botao-upload upl-escolher">
            <Icon nome="camera" tamanho={18} />
            Escolher imagem
          </label>
        )}
      </div>
    </section>
  );
}

export default UploadCard;
