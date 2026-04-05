from fastapi import APIRouter
from app.api.routes import auth, portfolios, prices, import_xtb

api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router)
api_router.include_router(portfolios.router)
api_router.include_router(prices.router)
api_router.include_router(import_xtb.router)
