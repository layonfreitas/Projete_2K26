import logoCoffeeVision from "../assets/logo-coffeevision.png";
import "./AuthShell.css";

// Moldura das telas de acesso (login e recuperação de senha).
export default function AuthShell({ titulo, subtitulo, children, rodape }) {
  return (
    <div className="auth-pagina">
      <main className="auth-cartao">
        <div className="auth-marca">
          <span className="auth-logo">
            <img src={logoCoffeeVision} alt="Coffee Vision" width="168" height="168" />
          </span>
          <h1>{titulo}</h1>
          {subtitulo && <p>{subtitulo}</p>}
        </div>

        {children}

        {rodape && <div className="auth-rodape">{rodape}</div>}
      </main>
    </div>
  );
}
