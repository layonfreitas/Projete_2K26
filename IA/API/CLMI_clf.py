from weka.core.dataset import Instance 
import weka.core.jvm as jvm
from weka.classifiers import Classifier
from fastapi import FastAPI
from pydantic import BaseModel
from contextlib import asynccontextmanager

class Dados(BaseModel):
    clmi: float
    temperatura: float
    precipitacao: float

app = FastAPI()
modelo = None
cabecalho = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    jvm.start()
    global modelo, cabecalho 
    modelo, cabecalho = Classifier.deserialize("classificador_clm.model")

    yield

    jvm.stop()

app = FastAPI(lifespan = lifespan)


@app.post("/clmi_clf/")
async def classificar(dados: Dados):
    nova_instancia = create_instance([dados.clmi, dados.temperatura, dados.precipitacao, None])
    nova_instancia.dataset = cabecalho

    index_classificacao = modelo.classify_instance(nova_instancia)
    classificacao = nova_instancia.value(int(index_classificacao))
    print(classificacao)
    return {"classificacao": classificacao}


