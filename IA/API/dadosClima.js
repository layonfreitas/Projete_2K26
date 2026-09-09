import {fetchWeatherApi} from "openmeteo"

async function getWeatherData(lat, lon) {
    const data_fim = new Date();
    const data_inicio = new Date();
    data_inicio.setDate(data_fim.getDate() - 30);

    try{
        params= {
            latitude: lat,
            longitude: lon,
            start_date: data_inicio.toISOString().split('T')[0],
            end_date: data_fim.toISOString().split('T')[0],
            daily: ["temperature_2m_mean", "precipitation_sum"],
            timezone: "America/Sao_Paulo"
        }
        const url = "https://archive-api.open-meteo.com/v1/archive"
        const responses = await fetchWeatherApi(url, params)
        const response = responses[0]
        const daily = response.daily()
        temperature_2m_mean = daily.variables(0).valuesArray()
        precipitation_sum = daily.variables(1).valuesArray()
        precipitation_sum = precipitation_sum.map(value => value === null ? 0 : value)
        temperatura_media = temperature_2m_mean.reduce((acc, val) => acc + val, 0) / temperature_2m_mean.length
        
        resposta = {
            "mensagem": "Dados climaticos obtidos.",
            "temperatura_media": temperatura_media,
            "precipitacao ": precipitation_sum
        }

        return resposta
    }
    catch(error){

        console.error(error);
        mensagem = "Erro ao buscar dados do clima. Por favor, tente novamente mais tarde.";
        return { status: 500, mensagem: mensagem };
    }
}
