from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api import api_router
from app.db.database import Base, engine
from app.models import User, Portfolio, Transaction  # noqa: F401 — rejestracja modeli

# Utwórz tabele (w produkcji zastąp migracjami Alembic)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Portfolio Tracker API",
    version="1.0.0",
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health")
def health():
    return {"status": "ok"}
