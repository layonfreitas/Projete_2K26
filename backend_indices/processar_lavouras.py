"""Processamento por lavoura; falhas de um índice não interrompem os demais."""
from datetime import date
from datetime import date, timedelta
import logging
import requests
from get_indices import (get_indices_image,save_indice_map,obter_valores_indices,
                         api_url,SemDadosValidos,INDICES)
from z_score import salvar_mapa_z_score
from georreferencia import normalizar_coordenadas,criar_geometria
from gee_auth import inicializar_ee
import Flask

log = logging.getLogger(__name__)




def get_weather_data(lat, lon):
    data_fim = date.today()
    data_inicio = data_fim - timedelta(days=30)

    parametros = {
        "latitude": lat,
        "longitude": lon,
        "start_date": data_inicio.isoformat(),
        "end_date": data_fim.isoformat(),
        "daily": "temperature_2m_mean,precipitation_sum",
        "timezone": "America/Sao_Paulo"
    }

    url = "https://archive-api.open-meteo.com/v1/archive"

    try:
        resposta = requests.get(url, params=parametros, timeout=(15, 60))
        resposta.raise_for_status()

        dados = resposta.json()
        daily = dados["daily"]

        temperaturas = daily["temperature_2m_mean"]
        precipitacoes = [
            0 if valor is None else valor
            for valor in daily["precipitation_sum"]
        ]

        temperatura_media = sum(temperaturas) / len(temperaturas)
        precipitacao = sum(precipitacoes)

        return {
            "mensagem": "Dados climaticos obtidos.",
            "temperatura_media": temperatura_media,
            "precipitacao": precipitacao
        }

    except Exception as erro:
        print(erro)
        return {
            "status": 500,
            "mensagem": "Erro ao buscar dados do clima. Por favor, tente novamente mais tarde."
        }



def obter_classificao(lat,lon,clmi):
    dados_climaticos = get_weather_data(lat, lon)
    dados = {
        "clmi":clmi,
        "temperatura":dados_climaticos["temperatura_media"],
        "precipitacao":dados_climaticos["precipitacao"]
    }
    resposta = requests.post(api_url('/clmi_clf'), json= jsonify(dados))
    resposta.raise_for_status()
    dados_resposta = resposta.json()
    classificao = dados_resposta.classificacao
    return classificao

    

    

def buscar_todas_lavouras():
    resposta = requests.get(api_url('/lavouras'),timeout=(15,60))
    resposta.raise_for_status()
    return resposta.json()


def processar_lavoura(lavoura, data_alvo=None, janela=30, indices=None, geometria=None):
    inicializar_ee()
    if geometria is None: geometria = criar_geometria(lavoura['coordenadas'])
    alvo = data_alvo or date.today().isoformat()
    indice_nomes = indices if indices is not None else [n for i in INDICES for n in (i,f'z-score-{i}')]
    resultado = {'lavouraId':lavoura['id'],'dataAlvo':alvo,'salvos':[], 'avisos':[], 'erros':[]}
    imagem = get_indices_image(geometria,alvo,janela,100)
    if imagem is None:
        resultado['status'] = 'sem_dados'
        resultado['avisos'].append('Nenhuma cena com cobertura válida suficiente nesta janela de datas.')
        log.warning('Lavoura %s: %s',lavoura['id'],resultado['avisos'][0])
        return resultado
    resultado['dataImagem'] = imagem.date().format('YYYY-MM-dd').getInfo()
    valores = obter_valores_indices(imagem,geometria)
    for nome in indice_nomes:
        try:
            if nome.startswith('z-score-') and nome.removeprefix('z-score-') in INDICES:
                salvar_mapa_z_score(imagem,nome.removeprefix('z-score-'),lavoura['usuarioId'],lavoura['id'],geometria)
            elif nome in INDICES:
                save_indice_map(imagem,nome,geometria,lavoura['usuarioId'],lavoura['id'],valores)
            else:
                raise ValueError(f'Índice não suportado: {nome}')
            resultado['salvos'].append(nome)
        except SemDadosValidos as erro:
            resultado['avisos'].append(f'{nome}: {erro}')
            log.warning('Lavoura %s / %s: %s',lavoura['id'],nome,erro)
        except Exception as erro:
            resultado['erros'].append(f'{nome}: {erro}')
            log.exception('Falha na lavoura %s / %s',lavoura['id'],nome)

    clmi = valores.get('CLMI')   
            
    resultado['status'] = ('parcial' if resultado['salvos'] else 'erro') if resultado['erros'] else ('concluido' if resultado['salvos'] else 'sem_dados')
    log.info('Lavoura %s: %s; %s mapas salvos.',lavoura['id'],resultado['status'],len(resultado['salvos']))
    return resultado


def processar_todas_lavouras():
    resultados=[]
    for lavoura in buscar_todas_lavouras():
        try:
            resultados.append(processar_lavoura(lavoura))
        except Exception as erro:
            log.exception('Falha na lavoura %s',lavoura.get('id'))
            resultados.append({'lavouraId':lavoura.get('id'),'status':'erro','erros':[str(erro)]})
    log.info('Processamento concluído: %s',[(r['lavouraId'],r['status']) for r in resultados])
    return resultados


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO,format='%(levelname)s %(message)s')
    processar_todas_lavouras()
