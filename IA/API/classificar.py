# É necessário enviar um File object, idealmente em FormData, porque é fácil de manipular

from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import io
import numpy as np
from PIL import Image
import onnxruntime as ort

# ---------------------------------------------------------------------------
# Configuração do modelo
# ---------------------------------------------------------------------------
MODEL_PATH = "best.onnx"
IMG_SIZE = 640          # imgsz que o modelo foi exportado (ver metadata do onnx)
CONF_THRESHOLD = 0.25   # mesmo valor padrão que a ultralytics usa em model(image)

# Classes exportadas junto com o modelo (metadata "names" do best.onnx)
CLASS_NAMES = {0: "Cercospora", 1: "Miner", 2: "Phoma", 3: "Rust"}

# Sessão do onnxruntime é carregada uma única vez, na subida do servidor
session = ort.InferenceSession(MODEL_PATH, providers=["CPUExecutionProvider"])
INPUT_NAME = session.get_inputs()[0].name

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


def letterbox(image: Image.Image, new_size: int = IMG_SIZE, color=(114, 114, 114)) -> Image.Image:
    """
    Redimensiona a imagem mantendo a proporção (igual ao letterbox que a
    ultralytics faz por baixo dos panos) e preenche o resto com cinza,
    até chegar em new_size x new_size. Isso é o que garante que a
    classificação saia igual à versão antiga (que usava o wrapper YOLO).
    """
    original_w, original_h = image.size
    scale = min(new_size / original_w, new_size / original_h)
    new_w, new_h = int(round(original_w * scale)), int(round(original_h * scale))

    resized = image.resize((new_w, new_h), Image.BILINEAR)

    canvas = Image.new("RGB", (new_size, new_size), color)
    pad_x = (new_size - new_w) // 2
    pad_y = (new_size - new_h) // 2
    canvas.paste(resized, (pad_x, pad_y))
    return canvas


def preprocess(image: Image.Image) -> np.ndarray:
    image = image.convert("RGB")
    image = letterbox(image)

    arr = np.asarray(image, dtype=np.float32) / 255.0   # 0-255 -> 0-1
    arr = arr.transpose(2, 0, 1)                        # HWC -> CHW
    arr = np.expand_dims(arr, axis=0)                   # adiciona o batch
    return np.ascontiguousarray(arr)


# caminho(url) completo é http://127.0.0.1:8000/classificar/, até hospedarmos em servidor, se o fizermos
@app.post("/classificar/")
async def classificar(imagem: UploadFile):
    try:
        contents = await imagem.read()               # extrai as informações do arquivo
        image = Image.open(io.BytesIO(contents))      # extrai os bytes da imagem
        input_tensor = preprocess(image)

        # output0: shape (1, 300, 6) -> cada linha é [x1, y1, x2, y2, confianca, classe]
        # (modelo end-to-end, já vem sem precisar rodar NMS manualmente)
        outputs = session.run(None, {INPUT_NAME: input_tensor})
        detections = outputs[0][0]

        names = []
        for det in detections:
            conf = float(det[4])
            if conf < CONF_THRESHOLD:
                continue
            cls_id = int(det[5])
            names.append(CLASS_NAMES.get(cls_id, str(cls_id)))

        return {
            # Será enviado algo como : ["Rust", "Phoma", "Phoma"].
            # Lógica para como o frontend vai interpretar isso deve ser aplicado na camada intermediária
            "resultado": names
        }

    except Exception as e:
        print(f"Erro interno: {e}")
        raise HTTPException(status_code=500, detail=str(e))