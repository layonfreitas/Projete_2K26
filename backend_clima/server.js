import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();

// portas/origens que podem chamar esse servidor.
// em dev, o Vite roda em localhost:5173. Depois que você hospedar o
// frontend em produção, adiciona a URL final aqui também.
const origensPermitidas = [
  "http://localhost:5173",
  process.env.FRONTEND_URL, // ex: https://seu-frontend.onrender.com
].filter(Boolean);

app.use(
  cors({
    origin: origensPermitidas,
  })
);

const PORTA = process.env.PORT || 5001;
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;

// pequeno "dicionário" pra deixar mais fácil de mexer se um dia
// você trocar de provedor de clima
function traduzirRespostaOpenWeather(dados) {
  return {
    cidade: dados.name,
    temperatura: dados.main?.temp,
    umidade: dados.main?.humidity,
    vento: dados.wind?.speed,
    condicao: dados.weather?.[0]?.description,
    icone: dados.weather?.[0]?.icon,
  };
}

app.get("/clima", async (req, res) => {
  const { lat, lon } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({
      mensagem: "Os parâmetros 'lat' e 'lon' são obrigatórios.",
    });
  }

  if (!OPENWEATHER_API_KEY) {
    console.error(
      "OPENWEATHER_API_KEY não configurada. Crie um arquivo .env com essa variável."
    );
    return res.status(500).json({
      mensagem: "Servidor de clima não está configurado corretamente.",
    });
  }

  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=pt_br&appid=${OPENWEATHER_API_KEY}`;

  try {
    const respostaOpenWeather = await fetch(url);
    const dados = await respostaOpenWeather.json();

    if (!respostaOpenWeather.ok) {
      return res.status(respostaOpenWeather.status).json({
        mensagem: dados.message || "Erro ao consultar o serviço de clima.",
      });
    }

    return res.status(200).json(traduzirRespostaOpenWeather(dados));
  } catch (erro) {
    console.error("Erro ao buscar clima:", erro);
    return res.status(502).json({
      mensagem: "Não foi possível conectar ao serviço de clima.",
    });
  }
});

// rota simples só pra confirmar que o servidor está de pé
app.get("/", (req, res) => {
  res.send("Servidor de clima do Projete rodando.");
});

app.listen(PORTA, () => {
  console.log(`Servidor de clima rodando em http://localhost:${PORTA}`);
});