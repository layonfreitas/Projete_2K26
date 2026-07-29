import { useState, useEffect } from "react";
import "./dados_clima.css"
// useState: guarda valores que mudam com o tempo (clima, carregando, erro)
// useEffect: roda um código automaticamente quando o componente aparece na tela
//            (ou quando latitude/longitude mudam)

function Clima({ latitude, longitude }) {
  // esse componente recebe latitude e longitude como "props"
  // (valores passados por quem usa <Clima latitude={...} longitude={...} />)

  const [clima, setClima] = useState(null);
  // guarda os dados do clima que vieram da API. Começa como "null" (vazio)
  // porque, antes de buscar, ainda não temos nenhuma informação

  const [carregando, setCarregando] = useState(true);
  // controla se está "carregando" ou não. Começa como true, porque assim
  // que o componente aparece, ele já vai tentar buscar o clima

  const [erro, setErro] = useState("");
  // guarda mensagem de erro, caso algo dê errado. Começa vazio

  useEffect(() => {
    // esse bloco roda automaticamente sempre que latitude ou longitude mudarem
    // (por exemplo, quando o usuário troca de lavoura selecionada)

    if (!latitude || !longitude) return;
    // proteção: se não tiver coordenadas ainda (ex: nenhuma lavoura selecionada),
    // não faz sentido tentar buscar clima — então a função para aqui mesmo

    async function buscarClima() {
      // função "async" porque vamos usar "await" dentro dela
      // (esperar a resposta da API antes de continuar)

      setCarregando(true);
      // avisa a tela: "estou buscando, mostra o texto de carregando"

      setErro("");
      // limpa qualquer erro antigo, já que estamos tentando de novo

      try {
        // "try" = tenta rodar esse código; se der erro, pula pro "catch" lá embaixo

        const apiKey = "clima123"; //  exposta no frontend, só pra teste
        // essa é a "senha" que a OpenWeatherMap usa pra saber quem está pedindo
        // os dados. Trocar "SUA_CHAVE_AQUI" pela chave real que você criar no site deles

        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&lang=pt_br&appid=${apiKey}`;
        // monta o endereço da API, colocando:
        // lat/lon = a localização que queremos consultar
        // units=metric = pedir temperatura em Celsius (senão vem em Kelvin)
        // lang=pt_br = pedir a descrição do clima em português
        // appid = a chave de API

        const resposta = await fetch(url);
        // faz a requisição de verdade pra esse endereço, e espera a resposta chegar
        // ("await" pausa aqui até a internet responder)

        const dados = await resposta.json();
        // transforma a resposta (que vem em formato bruto) em um objeto
        // JavaScript que dá pra usar normalmente (dados.main.temp, etc)

        if (resposta.ok) {
          // "resposta.ok" é true quando o servidor respondeu com sucesso (200)
          setClima(dados);
          // guarda os dados do clima recebidos, pra usar na tela
        } else {
          // se deu algum erro (ex: coordenada inválida, chave errada)
          setErro(dados.message || "Erro ao buscar clima.");
          // guarda a mensagem de erro que a API mandou, ou uma genérica
        }
      } catch (erroRequisicao) {
        // cai aqui se a internet caiu, o servidor não respondeu, etc
        // (erro de rede, diferente de erro da API)

        setErro("Erro ao conectar com o serviço de clima.");
        console.error(erroRequisicao);
        // mostra o erro técnico completo no console, pra você debugar
      } finally {
        // "finally" roda sempre, independente de ter dado certo ou erro

        setCarregando(false);
        // avisa a tela: "terminei de carregar" (seja com sucesso ou erro)
      }
    }

    buscarClima();
    // chama a função que acabamos de criar — sem isso, ela nunca executaria

  }, [latitude, longitude]); // roda de novo se a lavoura selecionada mudar
  // essa lista entre colchetes é a "lista de dependências" do useEffect:
  // toda vez que "latitude" ou "longitude" mudarem de valor, o React
  // roda esse bloco de código de novo automaticamente

  if (carregando) return <p>Carregando clima...</p>;
  // enquanto estiver buscando, mostra só esse texto na tela (nada mais)

  if (erro) return <p className="erro">{erro}</p>;
  // se deu erro, mostra só a mensagem de erro (nada mais)

  if (!clima) return null;
  // se não está carregando, não deu erro, mas ainda não tem dado de clima
  // (ex: latitude/longitude nunca foram passadas), não mostra nada

  return (
    <div className="clima-card">
      <h3>Clima em {clima.name}</h3>
      {/* clima.name = nome da cidade que a API identificou pela coordenada */}

      <p>🌡️ Temperatura: {clima.main.temp}°C</p>
      {/* clima.main.temp = temperatura atual, já em Celsius (por causa do units=metric) */}

      <p>💧 Umidade: {clima.main.humidity}%</p>
      {/* clima.main.humidity = porcentagem de umidade do ar */}

      <p>🌬️ Vento: {clima.wind.speed} m/s</p>
      {/* clima.wind.speed = velocidade do vento, em metros por segundo */}

      <p>☁️ Condição: {clima.weather[0].description}</p>
      {/* clima.weather é uma LISTA (por isso o [0], pegando o primeiro item)
          .description = texto tipo "céu limpo", "nublado", etc */}
    </div>
  );
}

export default Clima;
// libera esse componente pra ser usado em outros arquivos do projeto,
// com: import Clima from "./Clima";