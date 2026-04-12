from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


# Portfolio
class PortfolioCreate(BaseModel):
    name: str
    description: Optional[str] = None
    currency: str = "PLN"


class PortfolioUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class PortfolioOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    currency: str
    created_at: datetime

    class Config:
        from_attributes = True


# Transaction
class TransactionCreate(BaseModel):
    transaction_type: str  # buy | sell | dividend | split | deposit | withdrawal
    ticker: Optional[str] = None
    name: Optional[str] = None             # ← NOWE: pełna nazwa spółki
    asset_class: Optional[str] = "Akcje"
    currency: Optional[str] = "PLN"
    quantity: Optional[float] = None
    price: Optional[float] = None
    exchange_rate: Optional[float] = 1.0
    amount_pln: Optional[float] = None
    date: Optional[datetime] = None
    notes: Optional[str] = None


class TransactionOut(BaseModel):
    id: int
    portfolio_id: int
    transaction_type: str
    ticker: Optional[str]
    name: Optional[str]                    # ← NOWE
    asset_class: Optional[str]
    currency: Optional[str]
    quantity: Optional[float]
    price: Optional[float]
    price_pln: Optional[float]
    exchange_rate: Optional[float]
    amount_pln: Optional[float]
    date: datetime
    notes: Optional[str]

    class Config:
        from_attributes = True


# Position (wyliczana z transakcji, nie przechowywana)
class PositionOut(BaseModel):
    ticker: str
    name: Optional[str] = None             # ← NOWE: pełna nazwa spółki
    asset_class: str
    currency: str
    quantity: float
    avg_purchase_price: float
    avg_purchase_price_pln: float
    first_purchase_date: Optional[datetime]
    # Wzbogacone o ceny na żywo
    current_price: Optional[float] = None
    current_price_pln: Optional[float] = None
    current_value_pln: Optional[float] = None
    cost_pln: Optional[float] = None
    gain_loss_pln: Optional[float] = None
    gain_loss_pct: Optional[float] = None
    daily_change_pct: Optional[float] = None
    daily_change_pln: Optional[float] = None


# Portfolio summary
class PortfolioSummary(BaseModel):
    portfolio: PortfolioOut
    positions: List[PositionOut]
    total_value_pln: float
    total_cost_pln: float
    total_gain_loss_pln: float
    total_gain_loss_pct: float
    daily_change_pln: float
    cash_pln: float
