"""Travas e limite de processamentos simultâneos do backend_indices.

- Uma trava por lavoura: a mesma lavoura nunca é processada por duas
  threads ao mesmo tempo (evita sobrescrever a série zarr).
- Um limite global de processamentos pesados em paralelo, para não
  estourar a memória nem o limite de requisições do Earth Engine.
  O lote diário também usa uma vaga por vez.

Ajuste o limite no .env com PROCESSAMENTOS_SIMULTANEOS (padrão: 3).
"""
import os
import time
from contextlib import contextmanager
from threading import BoundedSemaphore, Lock

VAGAS = max(1, int(os.getenv("PROCESSAMENTOS_SIMULTANEOS", "3")))

_vagas = BoundedSemaphore(VAGAS)
_travas = {}
_travas_lock = Lock()


class ServicoOcupado(Exception):
    """Não foi possível conseguir vaga dentro do tempo de espera."""


def _trava_da_lavoura(lavoura_id):
    with _travas_lock:
        return _travas.setdefault(str(lavoura_id), Lock())


def _adquirir(recurso, limite):
    if limite is None:
        return recurso.acquire()
    return recurso.acquire(timeout=max(limite - time.monotonic(), 0))


@contextmanager
def processamento_exclusivo(lavoura_id, espera=None):
    """Garante exclusividade da lavoura e uma vaga de processamento.

    espera=None espera quanto for preciso; com um número (segundos),
    levanta ServicoOcupado se não conseguir a tempo.
    A trava da lavoura é pega antes da vaga, assim quem espera pela
    mesma lavoura não ocupa uma vaga à toa.
    """
    limite = None if espera is None else time.monotonic() + espera
    trava = _trava_da_lavoura(lavoura_id)

    if not _adquirir(trava, limite):
        raise ServicoOcupado(f"Lavoura {lavoura_id} já está em processamento.")

    try:
        if not _adquirir(_vagas, limite):
            raise ServicoOcupado("Todas as vagas de processamento estão em uso.")
        try:
            yield
        finally:
            _vagas.release()
    finally:
        trava.release()