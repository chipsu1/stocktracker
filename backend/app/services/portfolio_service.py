from sqlalchemy.orm import Session
from typing import List, Optional
from fastapi import HTTPException, status

from app.models.portfolio import Portfolio, Position, Transaction
from app.schemas.portfolio import (
    PortfolioCreate, PortfolioUpdate,
    PositionCreate, PositionUpdate,
    TransactionCreate, PortfolioSummary, PositionEnriched
)
from app.services.price_service import get_prices_batch


# --- Portfolios ---

def get_user_portfolios(db: Session, user_id: int) -> List[Portfolio]:
    return db.query(Portfolio).filter(Portfolio.user_id == user_id).all()


def get_portfolio(db: Session, portfolio_id: int, user_id: int) -> Portfolio:
    portfolio = db.query(Portfolio).filter(
        Portfolio.id == portfolio_id,
        Portfolio.user_id == user_id
    ).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio nie znalezione")
    return portfolio


def create_portfolio(db: Session, user_id: int, data: PortfolioCreate) -> Portfolio:
    portfolio = Portfolio(user_id=user_id, **data.model_dump())
    db.add(portfolio)
    db.commit()
    db.refresh(portfolio)
    return portfolio


def update_portfolio(db: Session, portfolio_id: int, user_id: int, data: PortfolioUpdate) -> Portfolio:
    portfolio = get_portfolio(db, portfolio_id, user_id)
    for key, value in data.model_dump(exclude_none=True).items():
        setattr(portfolio, key, value)
    db.commit()
    db.refresh(portfolio)
    return portfolio


def delete_portfolio(db: Session, portfolio_id: int, user_id: int):
    portfolio = get_portfolio(db, portfolio_id, user_id)
    db.delete(portfolio)
    db.commit()


# --- Positions ---

def get_positions(db: Session, portfolio_id: int, user_id: int) -> List[Position]:
    get_portfolio(db, portfolio_id, user_id)
    return db.query(Position).filter(Position.portfolio_id == portfolio_id).all()


def create_position(db: Session, portfolio_id: int, user_id: int, data: PositionCreate) -> Position:
    get_portfolio(db, portfolio_id, user_id)

    avg_pln = data.avg_purchase_price * (data.exchange_rate_at_purchase or 1.0)

    position = Position(
        portfolio_id=portfolio_id,
        avg_purchase_price_pln=avg_pln,
        **data.model_dump()
    )
    db.add(position)
    db.commit()
    db.refresh(position)
    return position


def update_position(db: Session, position_id: int, user_id: int, data: PositionUpdate) -> Position:
    position = db.query(Position).join(Portfolio).filter(
        Position.id == position_id,
        Portfolio.user_id == user_id
    ).first()
    if not position:
        raise HTTPException(status_code=404, detail="Pozycja nie znaleziona")
    for key, value in data.model_dump(exclude_none=True).items():
        setattr(position, key, value)
    db.commit()
    db.refresh(position)
    return position


def delete_position(db: Session, position_id: int, user_id: int):
    position = db.query(Position).join(Portfolio).filter(
        Position.id == position_id,
        Portfolio.user_id == user_id
    ).first()
    if not position:
        raise HTTPException(status_code=404, detail="Pozycja nie znaleziona")
    db.delete(position)
    db.commit()


# --- Portfolio Summary (z cenami na żywo) ---

def get_portfolio_summary(db: Session, portfolio_id: int, user_id: int) -> PortfolioSummary:
    portfolio = get_portfolio(db, portfolio_id, user_id)
    positions = db.query(Position).filter(Position.portfolio_id == portfolio_id).all()

    if not positions:
        return PortfolioSummary(
            portfolio=portfolio,
            positions=[],
            total_value_pln=0,
            total_cost_pln=0,
            total_gain_loss_pln=0,
            total_gain_loss_pct=0,
            daily_change_pln=0,
        )

    # Pobierz ceny w batchu
    tickers = [(p.ticker, p.currency) for p in positions]
    prices = get_prices_batch(tickers)

    enriched = []
    total_value = 0
    total_cost = 0
    total_daily = 0

    for pos in positions:
        price_data = prices.get(pos.ticker, {})
        current_price = price_data.get("price")
        fx_rate = price_data.get("fx_rate", 1.0)
        daily_pct = price_data.get("daily_change_pct")

        cost_pln = pos.quantity * (pos.avg_purchase_price_pln or pos.avg_purchase_price)
        current_value_pln = None
        gain_loss_pln = None
        gain_loss_pct = None
        daily_change_pln = None
        current_price_pln = None

        if current_price is not None:
            current_price_pln = current_price * fx_rate
            current_value_pln = pos.quantity * current_price_pln
            gain_loss_pln = current_value_pln - cost_pln
            gain_loss_pct = (gain_loss_pln / cost_pln * 100) if cost_pln > 0 else 0
            daily_change_pln = current_value_pln * (daily_pct / 100) if daily_pct else 0
            total_value += current_value_pln
            total_daily += daily_change_pln

        total_cost += cost_pln

        enriched.append(PositionEnriched(
            **{c.name: getattr(pos, c.name) for c in pos.__table__.columns},
            current_price=current_price,
            current_price_pln=current_price_pln,
            current_value_pln=current_value_pln,
            cost_pln=cost_pln,
            gain_loss_pln=gain_loss_pln,
            gain_loss_pct=gain_loss_pct,
            daily_change_pct=daily_pct,
            daily_change_pln=daily_change_pln,
        ))

    total_gain = total_value - total_cost
    total_gain_pct = (total_gain / total_cost * 100) if total_cost > 0 else 0

    return PortfolioSummary(
        portfolio=portfolio,
        positions=enriched,
        total_value_pln=total_value,
        total_cost_pln=total_cost,
        total_gain_loss_pln=total_gain,
        total_gain_loss_pct=total_gain_pct,
        daily_change_pln=total_daily,
    )


# --- Transactions ---

def add_transaction(db: Session, position_id: int, user_id: int, data: TransactionCreate) -> Transaction:
    position = db.query(Position).join(Portfolio).filter(
        Position.id == position_id,
        Portfolio.user_id == user_id
    ).first()
    if not position:
        raise HTTPException(status_code=404, detail="Pozycja nie znaleziona")

    price_pln = data.price * (data.exchange_rate or 1.0)
    tx = Transaction(
        position_id=position_id,
        price_pln=price_pln,
        **data.model_dump()
    )
    db.add(tx)

    # Aktualizuj avg_purchase_price jeśli BUY
    if data.transaction_type == "buy":
        total_qty = position.quantity + data.quantity
        total_cost = (position.avg_purchase_price * position.quantity) + (data.price * data.quantity)
        position.quantity = total_qty
        position.avg_purchase_price = total_cost / total_qty if total_qty > 0 else 0
        position.avg_purchase_price_pln = position.avg_purchase_price * (data.exchange_rate or 1.0)
    elif data.transaction_type == "sell":
        position.quantity = max(0, position.quantity - data.quantity)

    db.commit()
    db.refresh(tx)
    return tx
