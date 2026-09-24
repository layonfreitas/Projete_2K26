from dotenv import load_dotenv
from processar_lavouras import processar_lavoura
import requests
import os
load_dotenv()

def testando():
    resposta = requests.get(os.environ.get(""))

