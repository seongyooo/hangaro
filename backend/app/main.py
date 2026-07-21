from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import recommend, spots, congestion
from app.core.config import settings

app = FastAPI(title="HanGaRo API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(recommend.router, prefix="/api/recommend", tags=["recommend"])
app.include_router(spots.router,     prefix="/api/spots",     tags=["spots"])
app.include_router(congestion.router, prefix="/api/congestion", tags=["congestion"])


@app.get("/health")
def health():
    return {"status": "ok"}
