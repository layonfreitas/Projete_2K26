from serie_temporal import make_time_series 
from gee_auth import inicializar_ee
import fastapi  

@asynccontextmanager
async def lifespan(app: FastAPI):
    inicializar_ee()
    yield


app = FastAPI(lifespan=lifespan)
