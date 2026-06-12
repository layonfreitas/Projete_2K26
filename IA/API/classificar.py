# É necessário enviar um File object, idealmente em FormData, porque é fácil de manipular



from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
import io
from PIL import Image

model = YOLO("best.onnx")
app = FastAPI()

origins = [
    "http://localhost.tiangolo.com",
    "https://localhost.tiangolo.com",
    "http://localhost",
    "http://localhost:8080",
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# caminho(url) completo é http://127.0.0.1:8000/classificar/, até hospedarmos em servidor, se o fizermos
@app.post("/classificar/")
async def classificar(imagem: UploadFile):
    try:
        contents = await imagem.read() # extrai as informações do arquivo
        image = Image.open(io.BytesIO(contents)) # extrai os bytes da imagem para que o modelo consiga classificá-la
        results = model(image)

        names = []
        for result in results:
            if result.boxes is not None:
                names.extend([result.names[cls.item()] for cls in result.boxes.cls.int()])

        return {
          # Será enviado algo como : ["Rust", "Phoma", "Phoma"]. 
          #Lógica para como o frontend va interpretar isso deve ser aplicado na camada intermediária
            "resultado": names 
        }
        
    except Exception as e:
        print(f"Erro interno: {e}")
        raise HTTPException(status_code=500, detail=str(e))
