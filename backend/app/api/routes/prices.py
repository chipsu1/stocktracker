from fastapi import APIRouter, Depends, Query
from typing import List

from app.core.security import get_current_user
from app.models.user import User
from app.services.price_service import get_price, get_fx_rate_pln

router = APIRouter(prefix="/prices", tags=["prices"])


@router.get("/quote")
def get_quote(
    ticker: str = Query(...),
    currency: str = Query(default="PLN"),
    current_user: User = Depends(get_current_user)
):
    return get_price(ticker, currency)


@router.get("/fx")
def get_fx(
    currency: str = Query(...),
    current_user: User = Depends(get_current_user)
):
    rate = get_fx_rate_pln(currency)
    return {"currency": currency, "rate_pln": rate}
