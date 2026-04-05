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


# Position
class PositionCreate(BaseModel):
    ticker: str
    name: Optional[str] = None
    asset_class: str = "Akcje zagraniczne"
    currency: str = "PLN"
    quantity: float
    avg_purchase_price: float
    exchange_rate_at_purchase: Optional[float] = 1.0
    purchase_date: Optional[datetime] = None


class PositionUpdate(BaseModel):
    name: Optional[str] = None
    asset_class: Optional[str] = None
    quantity: Optional[float] = None
    avg_purchase_price: Optional[float] = None


class PositionOut(BaseModel):
    id: int
    portfolio_id: int
    ticker: str
    name: Optional[str]
    asset_class: str
    currency: str
    quantity: float
    avg_purchase_price: float
    avg_purchase_price_pln: Optional[float]
    exchange_rate_at_purchase: Optional[float]
    purchase_date: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


# Enriched position (with live price)
class PositionEnriched(PositionOut):
    current_price: Optional[float] = None
    current_price_pln: Optional[float] = None
    current_value_pln: Optional[float] = None
    cost_pln: Optional[float] = None
    gain_loss_pln: Optional[float] = None
    gain_loss_pct: Optional[float] = None
    daily_change_pct: Optional[float] = None
    daily_change_pln: Optional[float] = None


# Transaction
class TransactionCreate(BaseModel):
    transaction_type: str  # buy | sell | dividend
    quantity: float
    price: float
    exchange_rate: Optional[float] = 1.0
    notes: Optional[str] = None


class TransactionOut(BaseModel):
    id: int
    position_id: int
    transaction_type: str
    quantity: float
    price: float
    price_pln: Optional[float]
    exchange_rate: float
    date: datetime
    notes: Optional[str]

    class Config:
        from_attributes = True


# Portfolio summary
class PortfolioSummary(BaseModel):
    portfolio: PortfolioOut
    positions: List[PositionEnriched]
    total_value_pln: float
    total_cost_pln: float
    total_gain_loss_pln: float
    total_gain_loss_pct: float
    daily_change_pln: float
