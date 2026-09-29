import math
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo
import requests


def converter_data(valor):
    if isinstance(valor, datetime):
        return valor.date()

    if isinstance(valor, date):
        return valor

    return date.fromisoformat(str(valor))


def consultar_temperaturas(latitude, longitude, inicio, fim, url):
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "start_date": inicio.isoformat(),
        "end_date": fim.isoformat(),
        "daily": "temperature_2m_max,temperature_2m_min",
        "temperature_unit": "celsius",
        "timezone": "auto",
    }

    resposta = requests.get(
        url,
        params=params,
        timeout=60,
    )

    if not resposta.ok:
        raise RuntimeError(
            f"Erro no Open-Meteo: HTTP {resposta.status_code}. "
            f"{resposta.text[:500]}"
        )

    dados = resposta.json()

    if dados.get("error"):
        raise RuntimeError(
            dados.get("reason", "Erro ao consultar temperaturas.")
        )

    daily = dados.get("daily") or {}

    dias = daily.get("time", [])
    maximas = daily.get("temperature_2m_max", [])
    minimas = daily.get("temperature_2m_min", [])

    if not dias or not (
        len(dias) == len(maximas) == len(minimas)
    ):
        raise RuntimeError(
            "O Open-Meteo retornou dados incompletos."
        )

    return {
        dia: (t_max, t_min)
        for dia, t_max, t_min in zip(dias, maximas, minimas)
    }


def get_graus_dia_data(latitude, longitude, dataInicio, dataFim):
    # Temperatura-base mantida em 10 °C.
    Tb = 10.0

    inicio = converter_data(dataInicio)
    fim = converter_data(dataFim)

    hoje = datetime.now(
        ZoneInfo("America/Sao_Paulo")
    ).date()

    if inicio > fim:
        raise ValueError(
            "A data inicial não pode ser posterior à data final."
        )

    if fim > hoje:
        raise ValueError(
            "A data final não pode ser posterior a hoje."
        )

    latitude = float(latitude)
    longitude = float(longitude)

    if not (
        -90 <= latitude <= 90
        and -180 <= longitude <= 180
    ):
        raise ValueError("Latitude ou longitude inválida.")

    temperaturas = {}

    # Histórico até antes dos últimos sete dias.
    inicio_recente = hoje - timedelta(days=6)

    if inicio < inicio_recente:
        fim_historico = min(
            fim,
            inicio_recente - timedelta(days=1),
        )

        temperaturas.update(
            consultar_temperaturas(
                latitude,
                longitude,
                inicio,
                fim_historico,
                "https://archive-api.open-meteo.com/v1/archive",
            )
        )

    # Dias recentes, incluindo hoje.
    if fim >= inicio_recente:
        temperaturas.update(
            consultar_temperaturas(
                latitude,
                longitude,
                max(inicio, inicio_recente),
                fim,
                "https://api.open-meteo.com/v1/forecast",
            )
        )

    graus_dia = 0.0
    dia = inicio

    while dia <= fim:
        dia_texto = dia.isoformat()
        valores = temperaturas.get(dia_texto)

        if valores is None or any(
            valor is None for valor in valores
        ):
            raise RuntimeError(
                f"Temperatura indisponível em {dia_texto}. "
                "Não foi possível calcular o período completo."
            )

        t_max, t_min = map(float, valores)

        if not all(math.isfinite(v) for v in (t_max, t_min)):
            raise RuntimeError(
                f"Temperatura inválida em {dia_texto}."
            )

        graus_dia += max(
            0.0,
            (t_max + t_min) / 2.0 - Tb,
        )

        dia += timedelta(days=1)

    return graus_dia