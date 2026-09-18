from datetime import date as Date
import math
import requests


def get_graus_dia_data(latitude, longitude, start_date, end_date=None):
    """Aceita um único dia ou intervalo inclusivo, mantendo as duas versões."""
    inicio = Date.fromisoformat(str(start_date))
    fim = Date.fromisoformat(str(end_date if end_date is not None else start_date))
    if fim < inicio:
        raise ValueError("A data final deve ser igual ou posterior à inicial.")
    params = {
        "latitude": latitude, "longitude": longitude,
        "start_date": inicio.isoformat(), "end_date": fim.isoformat(),
        "daily": "temperature_2m_max,temperature_2m_min", "timezone": "auto",
    }
    response = requests.get("https://archive-api.open-meteo.com/v1/archive", params=params, timeout=30)
    response.raise_for_status()
    daily = response.json().get("daily", {})
    datas = daily.get("time", [])
    maximas = daily.get("temperature_2m_max", [])
    minimas = daily.get("temperature_2m_min", [])
    esperado = (fim - inicio).days + 1
    if len(datas) != esperado or len(maximas) != esperado or len(minimas) != esperado:
        raise ValueError("Dados de temperatura incompletos para o período solicitado.")
    total = 0.0
    for dia, maxima, minima in zip(datas, maximas, minimas):
        if maxima is None or minima is None or not all(math.isfinite(v) for v in (maxima, minima)):
            raise ValueError(f"Temperatura indisponível em {dia}.")
        total += max(0.0, (maxima + minima) / 2 - 10.0)
    return total
