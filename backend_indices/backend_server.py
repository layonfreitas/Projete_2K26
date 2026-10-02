import ee
import os
import secrets
import logging
from pydantic import BaseModel, Field, model_validator
from fastapi import FastAPI, status, HTTPException, BackgroundTasks, Header
from datetime import date
from processar_lavouras import processar_todas_lavouras, processar_lavoura
from georreferencia import criar_geometria
from gee_auth import inicializar_ee
from threading import Lock, Thread
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
import queue
import time
import faulthandler

faulthandler.enable()
faulthandler.dump_traceback_later(
    60,
    repeat=False,
)

print("[INICIO] Carregando backend_server", flush=True)



_processamento_lock = Lock()
from dotenv import load_dotenv
load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

INDICES_URL = os.getenv("INDICES_URL", "http://localhost:8001")


class Coordenada(BaseModel):
    lat: float
    lng: float

class SafraReq(BaseModel):
    ano: int = Field(ge=2017)
    inicio: date
    fim: date

    @model_validator(mode="after")
    def validar_periodo(self):
        if self.ano > date.today().year:
            raise ValueError("O ano da safra não pode estar no futuro.")

        if not date(2017, 3, 28) <= self.inicio <= self.fim <= date.today():
            raise ValueError(
                "Informe um período entre 28/03/2017 e hoje."
            )

        return self


class Day_req(BaseModel):
    coordenadas: list[Coordenada]
    usuario_id: int
    lavoura_id: int
    safras: list[SafraReq] = Field(default_factory=list, max_length=30)

    @model_validator(mode="after")
    def validar_safras(self):
        periodos = sorted(self.safras, key=lambda safra: safra.inicio)

        anos = [safra.ano for safra in periodos]

        if len(anos) != len(set(anos)):
            raise ValueError("Há anos de safra repetidos.")

        for anterior, atual in zip(periodos, periodos[1:]):
            if atual.inicio <= anterior.fim:
                raise ValueError("Os períodos das safras se sobrepõem.")

        self.safras = periodos
        return self
    
class Zona_de_manejo_req(BaseModel):
    coordenadas: list[list[float]]
    data_inicio: date
    data_fim: date
    usuario_id: int
    lavoura_id: int
    tamanho_min: float


indices = ["NDVI", "NDRE", "NDWI"]

# ============================================================
# FILA DE PROCESSAMENTO E AGENDAMENTO DIÁRIO
# ============================================================
# Um único worker processa um trabalho por vez (o Earth Engine e o
# banco aguentam melhor assim). Se o serviço estiver ocupado, o novo
# pedido entra na fila em vez de ser recusado.

_fila = queue.Queue()
_fila_lock = Lock()
_pendentes = []      # trabalhos aguardando, em ordem
_atual = None        # trabalho em execução

FUSO = ZoneInfo(os.getenv("AGENDAMENTO_FUSO", "America/Sao_Paulo"))
HORA_DIARIA = os.getenv("PROCESSAMENTO_DIARIO_HORA", "06:00")
AGENDADOR_ATIVO = os.getenv("AGENDADOR_ATIVO", "1") != "0"
ARQUIVO_ULTIMA_EXECUCAO = Path(
    os.getenv(
        "ARQUIVO_ULTIMA_EXECUCAO",
        str(Path(__file__).with_name("ultima_execucao_diaria.txt")),
    )
)
_espera_agendador_ate = 0.0


def _posicao(trabalho):
    """Posição na fila: 1 = é o próximo ou já está rodando."""
    ahead = (1 if _atual is not None else 0) + _pendentes.index(trabalho)
    return ahead + 1


def _enfileirar(tipo, chave, funcao, *args):
    """Coloca um trabalho na fila. Retorna (trabalho, repetido).

    Se já existe um trabalho igual aguardando (ou rodando, no caso do
    processamento geral), não duplica: devolve o existente.
    """
    with _fila_lock:
        for existente in _pendentes:
            if existente["tipo"] == tipo and existente["chave"] == chave:
                return existente, True

        if tipo == "todas" and _atual and _atual["tipo"] == "todas":
            return _atual, True

        trabalho = {
            "tipo": tipo,
            "chave": chave,
            "funcao": funcao,
            "args": args,
            "entrou_em": datetime.now(FUSO).isoformat(timespec="seconds"),
        }
        _pendentes.append(trabalho)
        _fila.put(trabalho)
        return trabalho, False


def _worker():
    global _atual

    while True:
        trabalho = _fila.get()

        with _fila_lock:
            if trabalho in _pendentes:
                _pendentes.remove(trabalho)
            _atual = trabalho

        try:
            with _processamento_lock:
                logging.info(
                    "[FILA] Iniciando %s (%s)",
                    trabalho["tipo"], trabalho["chave"],
                )
                trabalho["funcao"](*trabalho["args"])
        except Exception:
            logging.exception(
                "[FILA] Falha no trabalho %s (%s)",
                trabalho["tipo"], trabalho["chave"],
            )
        finally:
            with _fila_lock:
                _atual = None
            _fila.task_done()


def _ler_ultima_execucao():
    try:
        return ARQUIVO_ULTIMA_EXECUCAO.read_text().strip()
    except OSError:
        return ""


def _executar_todas(diario=False):
    global _espera_agendador_ate

    try:
        processar_todas_lavouras()
    except Exception:
        # Evita tentar de novo a cada minuto se algo estiver fora do ar.
        _espera_agendador_ate = time.time() + 30 * 60
        raise

    if diario:
        try:
            ARQUIVO_ULTIMA_EXECUCAO.write_text(
                datetime.now(FUSO).date().isoformat()
            )
        except OSError:
            logging.exception("[AGENDADOR] Não consegui gravar a data da última execução.")


def _agendador():
    """Dispara o processamento uma vez por dia, no horário configurado.

    Se o computador/servidor estava desligado na hora, roda assim que
    voltar (recuperação), desde que ainda não tenha rodado hoje.
    """
    try:
        hora, minuto = (int(x) for x in HORA_DIARIA.split(":"))
    except ValueError:
        logging.error(
            "[AGENDADOR] PROCESSAMENTO_DIARIO_HORA inválida (%r). Use HH:MM.",
            HORA_DIARIA,
        )
        return

    logging.info("[AGENDADOR] Ativo: execução diária às %02d:%02d (%s).", hora, minuto, FUSO.key)

    while True:
        try:
            agora = datetime.now(FUSO)
            alvo = agora.replace(hour=hora, minute=minuto, second=0, microsecond=0)

            if (
                agora >= alvo
                and _ler_ultima_execucao() != agora.date().isoformat()
                and time.time() >= _espera_agendador_ate
            ):
                _, repetido = _enfileirar("todas", "diario", _executar_todas, True)
                if not repetido:
                    logging.info("[AGENDADOR] Processamento diário enfileirado.")
        except Exception:
            logging.exception("[AGENDADOR] Erro inesperado.")

        time.sleep(60)


@asynccontextmanager
async def _ciclo_de_vida(_app):
    Thread(target=_worker, name="fila-processamento", daemon=True).start()

    if AGENDADOR_ATIVO:
        Thread(target=_agendador, name="agendador-diario", daemon=True).start()

    yield


app = FastAPI(lifespan=_ciclo_de_vida)

@app.get("/health", status_code=status.HTTP_200_OK)
async def health():

    return {"status": "ok"}


    





@app.post("/day_maps/")
def create_day_maps(day_req: Day_req):
    # Mantém o contrato desta rota: pares [longitude, latitude].
    espera = int(os.getenv("DAY_MAPS_ESPERA_SEGUNDOS", "300"))
    if not _processamento_lock.acquire(timeout=espera):
        raise HTTPException(
            status_code=503,
            detail="O serviço continua ocupado. Tente novamente em alguns minutos.",
            headers={"Retry-After": "60"},
        )
    try:
        inicializar_ee()
        coordenadas = [
        [p.lng, p.lat]
        for p in day_req.coordenadas
    ]
        geometria = criar_geometria(coordenadas, ordem='lnglat')
        resultado = processar_lavoura({'id':day_req.lavoura_id,'usuarioId':day_req.usuario_id, 'coordenadas': coordenadas}, geometria=geometria)
        print('geometria processada.')
        if resultado['status'] == 'sem_dados':
            raise HTTPException(status_code=422, detail=resultado)
        if resultado['status'] == 'erro':
            raise HTTPException(status_code=502, detail=resultado)

        print(resultado)
        return resultado
    finally:
        _processamento_lock.release()


@app.post("/processar_todas_lavouras/", status_code=202)
def processar_todas():
    trabalho, repetido = _enfileirar("todas", "manual", _executar_todas, False)
    with _fila_lock:
        posicao = _posicao(trabalho) if trabalho in _pendentes else 1
    return {
        "status": "ja_na_fila" if repetido else ("em_execucao" if posicao == 1 and _atual is trabalho else "na_fila"),
        "posicao": posicao,
        "mensagem": (
            "Já existe um processamento geral aguardando ou em andamento."
            if repetido else
            "Processamento geral enfileirado; acompanhe os resultados nos logs."
        ),
    }


@app.get("/fila/")
def estado_da_fila():
    with _fila_lock:
        return {
            "em_execucao": (
                {"tipo": _atual["tipo"], "chave": _atual["chave"]} if _atual else None
            ),
            "aguardando": [
                {"posicao": i + 1 + (1 if _atual else 0), "tipo": t["tipo"], "chave": t["chave"], "entrou_em": t["entrou_em"]}
                for i, t in enumerate(_pendentes)
            ],
            "agendador": {
                "ativo": AGENDADOR_ATIVO,
                "hora": HORA_DIARIA,
                "fuso": FUSO.key,
                "ultima_execucao_diaria": _ler_ultima_execucao() or None,
            },
        }


@app.post("/get_zona_de_manejo/", status_code=status.HTTP_201_CREATED)
async def zonas_de_manejo(zona_de_manejo_req: Zona_de_manejo_req):
    inicializar_ee()
    from serie_temporal import Imagem_para_zona_de_manejo, create_zonas_de_manejo
    geometria = ee.Geometry.Polygon(zona_de_manejo_req.coordenadas)
    usuario_id = zona_de_manejo_req.usuario_id
    lavoura_id = zona_de_manejo_req.lavoura_id
    array = Imagem_para_zona_de_manejo(geometria, zona_de_manejo_req.data_inicio.isoformat(), zona_de_manejo_req.data_fim.isoformat())
    arquivo = create_zonas_de_manejo(array = array,usuario_id= usuario_id, lavoura_id= lavoura_id, tamanho_min= zona_de_manejo_req.tamanho_min )
    return{
        "status": "sucesso",
        "mensagem": "Zonas de manejo criadas.",
        "arquivo": arquivo
    }

def _gerar_mapas_agendados(dados):
    try:
        from shapely.geometry import Polygon
        from xee import helpers

        from georreferencia import normalizar_coordenadas
        from serie_temporal import make_time_series

        safras = sorted(
            dados.get("safras") or [],
            key=lambda safra: safra["inicio"],
        )

        if safras:
            inicializar_ee()

            geometria = criar_geometria(
                dados["coordenadas"]
            )

            pontos = normalizar_coordenadas(
                dados["coordenadas"]
            )

            poligono = Polygon(pontos)
            lon = poligono.centroid.x
            lat = poligono.centroid.y

            zona = min(
                60,
                max(1, int((lon + 180) // 6) + 1),
            )

            codigo = (
                32600 if lat >= 0 else 32700
            ) + zona

            crs = f"EPSG:{codigo}"

            grade = helpers.fit_geometry(
                poligono,
                grid_crs=crs,
                grid_scale=(10, -10),
            )

            for posicao, safra in enumerate(safras):
                print(
                    "[SERIE] Chamando make_time_series: "
                    f"lavoura={dados['id']} "
                    f"safra={safra['ano']}",
                    flush=True,
                )

                resultado = make_time_series(
                    geometria=geometria,
                    data_inicio=safra["inicio"],
                    data_fim=safra["fim"],
                    usuario_id=dados["usuarioId"],
                    lavoura_id=dados["id"],
                    ano=safra["ano"],
                    crs=crs,
                    crsTransform=list(
                        grade["crs_transform"]
                    ),
                    # Recria o conjunto na primeira safra.
                    # As seguintes acrescentam suas datas.
                    reiniciar=(posicao == 0),
                )

                print(
                    f"[SERIE] Resultado: {resultado}",
                    flush=True,
                )
        else:
            print(
                "[SERIE] Nenhuma safra recebida; "
                "serão processados somente os mapas.",
                flush=True,
            )

        # Executa depois que todas as séries foram salvas.
        resultado_mapas = processar_lavoura(dados)

        print(
            f"[MAPAS] Resultado: {resultado_mapas}",
            flush=True,
        )

    except Exception:
        logging.exception(
            "[PROCESSAMENTO] Falha na lavoura %s",
            dados["id"],
        )


@app.post("/agendar_mapas/", status_code=202)
def agendar_mapas(
    day_req: Day_req,
    background_tasks: BackgroundTasks,
    x_mapas_token: str = Header(default=""),
):
    # Confere a senha enviada pelo backend do banco.
    token_esperado = os.getenv("MAPAS_INTERNAL_TOKEN", "")

    if (
        not token_esperado
        or not secrets.compare_digest(
            x_mapas_token,
            token_esperado,
        )
    ):
        raise HTTPException(
            status_code=401,
            detail="Credencial interna inválida.",
        )

    dados = {
    "id": day_req.lavoura_id,
    "usuarioId": day_req.usuario_id,
    "coordenadas": [
        {"lat": ponto.lat, "lng": ponto.lng}
        for ponto in day_req.coordenadas
    ],
    "safras": [
        safra.model_dump(mode="json")
        for safra in day_req.safras
    ],
}

    # Confere os pontos antes de aceitar a geração.
    from georreferencia import normalizar_coordenadas

    try:
        normalizar_coordenadas(dados["coordenadas"])

    except ValueError as erro:
        raise HTTPException(
            status_code=422,
            detail=str(erro),
        ) from erro

    # Entra na fila; se já há processamento, aguarda a vez.
    trabalho, repetido = _enfileirar(
        "lavoura",
        str(day_req.lavoura_id),
        _gerar_mapas_agendados,
        dados,
    )

    with _fila_lock:
        if trabalho in _pendentes:
            posicao = _posicao(trabalho)
        else:
            posicao = 1

    return {
        "status": "aceito" if posicao == 1 else "na_fila",
        "posicao": posicao,
        "repetido": repetido,
        "lavouraId": day_req.lavoura_id,
    }


faulthandler.cancel_dump_traceback_later()
print("[INICIO] backend_server carregado", flush=True)