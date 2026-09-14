"""Recria mapas antigos sem apagar registros. Sem --aplicar, somente lista."""
import argparse
from datetime import date
import logging
import json
import requests
from get_indices import api_url


def buscar(caminho,**params):
    r=requests.get(api_url(caminho),params=params,timeout=(15,60))
    r.raise_for_status()
    return r.json()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    grupo=parser.add_mutually_exclusive_group(required=True)
    grupo.add_argument('--lavoura',type=int)
    grupo.add_argument('--todas',action='store_true')
    parser.add_argument('--data',type=date.fromisoformat)
    parser.add_argument('--aplicar',action='store_true')
    args=parser.parse_args()
    lavouras=buscar('/lavouras')
    if args.lavoura is not None:
        lavouras=[l for l in lavouras if int(l['id'])==args.lavoura]
    if not lavouras: raise SystemExit('Nenhuma lavoura encontrada.')
    falhas=[]
    for lavoura in lavouras:
        historico=buscar(f"/imagens/{lavoura['id']}",usuario_id=lavoura['usuarioId'])
        if args.data: historico=[h for h in historico if h['data'][:10]==args.data.isoformat()]
        for registro in historico:
            dia=registro['data'][:10]
            nomes=[i for i in registro['indicesDisponiveis'] if i.removeprefix('z-score-') in ('NDVI','NDRE','NDWI')]
            print(f"Lavoura {lavoura['id']} / {dia}: {', '.join(nomes)}",flush=True)
            if not args.aplicar or not nomes: continue
            try:
                from gee_auth import inicializar_ee
                from georreferencia import criar_geometria
                from processar_lavouras import processar_lavoura
                inicializar_ee()
                # Reusa o contorno daquela imagem quando houver um snapshot.
                dados=buscar('/acessar_imagem',id=lavoura['id'],usuario_id=lavoura['usuarioId'],data=dia,indice=nomes[0])
                meta=dados.get('georreferencia') or {}
                if isinstance(meta,str): meta=json.loads(meta)
                coordenadas=meta.get('geometria') or lavoura['coordenadas']
                if not meta.get('geometria'):
                    print('Sem contorno histórico: usando o cadastro atual.',flush=True)
                resultado=processar_lavoura(lavoura,data_alvo=dia,janela=0,indices=nomes,geometria=criar_geometria(coordenadas))
                print(json.dumps(resultado,ensure_ascii=False),flush=True)
                if resultado['status'] in ('erro','parcial','sem_dados'):
                    falhas.append(f"{lavoura['id']}:{dia}")
            except Exception as erro:
                falhas.append(f"{lavoura['id']}:{dia}")
                logging.exception('Falha nessa data: %s',erro)
    if not args.aplicar: print('Prévia concluída. Acrescente --aplicar para gravar os mapas.')
    if falhas: raise SystemExit('Datas pendentes: '+', '.join(falhas))


if __name__=='__main__':
    logging.basicConfig(level=logging.INFO,format='%(levelname)s %(message)s')
    main()
