import openmeteo_requests

def get_graus_dia_data(latitude, longitude, date): 
    Tb  = 10.0
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "start_date": date,
        "end_date": date,
        "daily": "temperature_2m_max,temperature_2m_min",
        "timezone": "auto"
    }

    response = openmeteo_requests.get(url, params=params)
    if response.status_code !=200:
        raise Exception(f"Error fetching data from Open-Meteo API: {response.status_code} - {response.text}")

    data = response.json()
    daily = data["daily"]

    graus_dia = 0

    for i in range(len(daily["time"])):
        t_max = daily["temperature_2m_max"][i]
        t_min = daily["temperature_2m_min"][i]
        graus_dia += max(0, (t_max + t_min) / 2 - Tb)

    return graus_dia

