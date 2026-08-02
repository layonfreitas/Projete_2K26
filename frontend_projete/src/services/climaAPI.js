import { CLIMA_API_URL } from "../config/api";

// Este serviço fala com O SEU servidor de clima (Node.js ou Python),
// e não mais direto com o OpenWeatherMap. Assim a API key fica guardada
// no backend, e não exposta no código do frontend.
//
// CONTRATO ESPERADO da rota GET /clima?lat=..&lon=.. no seu servidor:
//
//   200 OK
//   {
//     "cidade": "São Sebastião do Paraíso",
//     "temperatura": 23.5,     // °C
//     "umidade": 60,           // %
//     "vento": 3.1,            // m/s
//     "condicao": "céu limpo", // descrição em pt-br
//     "icone": "01d"           // opcional, código do ícone do OpenWeatherMap
//   }
//
//   Em caso de erro, responder com status != 200 e:
//   { "mensagem": "descrição do erro" }
//
// Ou seja: seu servidor recebe lat/lon, consulta o provedor de clima que
// você escolher, e devolve só os campos já traduzidos/limpos acima —
// o frontend não precisa saber de onde veio o dado.

export async function buscarClima(lat, lng) {
  const resposta = await fetch(
    `${CLIMA_API_URL}/clima?lat=${lat}&lon=${lng}`
  );

  const dados = await resposta.json();

  if (!resposta.ok) {
    throw new Error(dados.mensagem || "Erro ao buscar dados do clima.");
  }

  return dados;
}