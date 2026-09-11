"""Recria mapas históricos de uma lavoura, na data real de cada imagem.

Execute dentro de backend_indices, com o mesmo ambiente do processamento diário.
Sem --aplicar, somente lista as datas; não envia imagens nem grava no banco.
"""
import argparse
from datetime import date
import json
import os

import requests
from dotenv import load_dotenv


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--lavoura', type=int, required=True)
    parser.add_argument('--data', type=date.fromisoformat, help='Opcional: AAAA-MM-DD')
    parser.add_argument('--aplicar', action='store_true')
    args = parser.parse_args()
    load_dotenv()
    base = os.environ['DATABASE_URL'].rstrip('/')

    def buscar(caminho, **parametros):
        resposta = requests.get(base + caminho, params=parametros, timeout=60)
        resposta.raise_for_status()
        return resposta.json()

    lavoura = next((l for l in buscar('/lavouras') if int(l['id']) == args.lavoura), None)
    if lavoura is None:
        raise SystemExit('Lavoura não encontrada.')
    historico = buscar(f'/imagens/{args.lavoura}', usuario_id=lavoura['usuarioId'])
    if args.data:
        historico = [h for h in historico if h['data'][:10] == args.data.isoformat()]
    for item in historico:
        print(f"Lavoura {args.lavoura}: {item['data']} — {', '.join(item['indicesDisponiveis'])}")
    if not historico:
        raise SystemExit('Nenhuma data encontrada no histórico selecionado.')
    if not args.aplicar:
        print('Prévia concluída. Acrescente --aplicar para gerar novamente essas imagens.')
        return

    import ee
    from get_indices import get_indices_image, obter_valores_indices, save_indice_map
    from z_score import salvar_mapa_z_score
    from processar_lavouras import normalizar_coordenadas

    coordenadas = lavoura['coordenadas']
    if isinstance(coordenadas, str):
        coordenadas = json.loads(coordenadas)
    geometria = ee.Geometry.Polygon(normalizar_coordenadas(coordenadas))
    falhas = []
    for item in historico:
        dia = item['data'][:10]
        try:
            # Janela zero busca apenas esse dia, nunca substitui por outra data.
            imagem = get_indices_image(geometria, dia, 0, 100)
            if imagem is None:
                raise ValueError('Nenhuma cena disponível nesta data; registro preservado.')
            valores = obter_valores_indices(imagem, geometria)
            for indice in item['indicesDisponiveis']:
                base_indice = indice.removeprefix('z-score-')
                if base_indice not in ('NDVI', 'NDRE', 'NDWI'):
                    raise ValueError(f'Índice não suportado por este reparo: {indice}')
                if indice.startswith('z-score-'):
                    salvar_mapa_z_score(imagem, base_indice, lavoura['usuarioId'], args.lavoura, geometria)
                else:
                    save_indice_map(imagem, indice, geometria, lavoura['usuarioId'], args.lavoura, valores)
            print(f'OK: {dia}')
        except Exception as erro:
            falhas.append(dia)
            print(f'FALHA em {dia}: {erro}')
    if falhas:
        raise SystemExit('Revise e tente novamente as datas com falha: ' + ', '.join(falhas))
    print('Reprocessamento concluído.')


if __name__ == '__main__':
    main()
