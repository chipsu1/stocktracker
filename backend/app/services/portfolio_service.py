from sqlalchemy.orm import Session
from typing import List, Dict
from fastapi import HTTPException
from datetime import datetime

from app.models.portfolio import Portfolio, Transaction
from app.schemas.portfolio import (
    PortfolioCreate, PortfolioUpdate,
    TransactionCreate, TransactionOut,
    PortfolioSummary, PositionOut
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


# --- Transactions ---

def _validate_transaction(data: TransactionCreate):
    """Walidacja danych transakcji."""
    if data.transaction_type in ("buy", "sell"):
        if not data.ticker:
            raise HTTPException(400, "Ticker jest wymagany dla zakupu/sprzedaży")
        if not data.quantity or data.quantity <= 0:
            raise HTTPException(400, "Liczba jednostek musi być większa od 0")
        if not data.price or data.price <= 0:
            raise HTTPException(400, "Cena musi być większa od 0")

    elif data.transaction_type == "dividend":
        if not data.ticker:
            raise HTTPException(400, "Ticker jest wymagany dla dywidendy")
        if not data.price or data.price <= 0:
            raise HTTPException(400, "Kwota dywidendy musi być większa od 0")

    elif data.transaction_type == "split":
        if not data.ticker:
            raise HTTPException(400, "Ticker jest wymagany dla splitu")
        if not data.quantity or data.quantity <= 0:
            raise HTTPException(400, "Współczynnik splitu musi być większy od 0")

    elif data.transaction_type in ("deposit", "withdrawal"):
        if not data.amount_pln or data.amount_pln <= 0:
            raise HTTPException(400, "Kwota musi być większa od 0")

    else:
        raise HTTPException(400, f"Nieznany typ transakcji: {data.transaction_type}")


def add_transaction(db: Session, portfolio_id: int, user_id: int, data: TransactionCreate) -> Transaction:
    get_portfolio(db, portfolio_id, user_id)
    _validate_transaction(data)

    price_pln = None
    if data.price is not None:
        price_pln = data.price * (data.exchange_rate or 1.0)

    tx_date = data.date or datetime.utcnow()

    tx = Transaction(
        portfolio_id=portfolio_id,
        transaction_type=data.transaction_type,
        ticker=data.ticker.upper().strip() if data.ticker else None,
        name=data.name.strip() if data.name else None,   # ← NOWE
        asset_class=data.asset_class,
        currency=data.currency,
        quantity=data.quantity,
        price=data.price,
        price_pln=price_pln,
        exchange_rate=data.exchange_rate or 1.0,
        amount_pln=data.amount_pln,
        date=tx_date,
        notes=data.notes,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


def get_transactions(db: Session, portfolio_id: int, user_id: int) -> List[Transaction]:
    get_portfolio(db, portfolio_id, user_id)
    return (
        db.query(Transaction)
        .filter(Transaction.portfolio_id == portfolio_id)
        .order_by(Transaction.date.desc())
        .all()
    )


def delete_transaction(db: Session, transaction_id: int, user_id: int):
    tx = (
        db.query(Transaction)
        .join(Portfolio)
        .filter(Transaction.id == transaction_id, Portfolio.user_id == user_id)
        .first()
    )
    if not tx:
        raise HTTPException(404, "Transakcja nie znaleziona")
    db.delete(tx)
    db.commit()


# --- Wyliczanie pozycji z transakcji ---

def _compute_positions(transactions: List[Transaction]) -> Dict[str, dict]:
    """
    Wylicza aktualne pozycje na podstawie listy transakcji.
    Zwraca dict: { ticker -> { quantity, avg_price, avg_price_pln, cost_pln, asset_class, currency, name, first_date } }
    """
    positions = {}

    for tx in sorted(transactions, key=lambda t: t.date):
        ticker = tx.ticker
        if not ticker:
            continue  # deposit/withdrawal nie mają tickera

        if ticker not in positions:
            positions[ticker] = {
                "ticker": ticker,
                "name": tx.name or None,           # ← NOWE: nazwa z pierwszej transakcji
                "asset_class": tx.asset_class or "Akcje",
                "currency": tx.currency or "PLN",
                "quantity": 0.0,
                "total_cost_pln": 0.0,
                "avg_purchase_price": 0.0,
                "avg_purchase_price_pln": 0.0,
                "first_purchase_date": None,
            }

        pos = positions[ticker]

        # Jeśli kolejna transakcja ma nazwę a poprzednia nie miała – uzupełnij
        if not pos["name"] and tx.name:
            pos["name"] = tx.name

        if tx.transaction_type == "buy":
            new_qty = pos["quantity"] + tx.quantity
            cost_this = tx.quantity * (tx.price_pln or tx.price or 0)
            pos["total_cost_pln"] += cost_this
            pos["avg_purchase_price_pln"] = pos["total_cost_pln"] / new_qty if new_qty > 0 else 0
            pos["avg_purchase_price"] = pos["avg_purchase_price_pln"] / (tx.exchange_rate or 1.0)
            pos["quantity"] = new_qty
            if pos["first_purchase_date"] is None:
                pos["first_purchase_date"] = tx.date

        elif tx.transaction_type == "sell":
            sold_qty = min(tx.quantity, pos["quantity"])
            if pos["quantity"] > 0:
                ratio = sold_qty / pos["quantity"]
                pos["total_cost_pln"] -= pos["total_cost_pln"] * ratio
            pos["quantity"] = max(0.0, pos["quantity"] - sold_qty)
            if pos["quantity"] == 0:
                pos["total_cost_pln"] = 0.0

        elif tx.transaction_type == "split":
            if pos["quantity"] > 0 and tx.quantity:
                new_qty = pos["quantity"] * tx.quantity
                pos["avg_purchase_price"] = pos["avg_purchase_price"] / tx.quantity
                pos["avg_purchase_price_pln"] = pos["avg_purchase_price_pln"] / tx.quantity
                pos["quantity"] = new_qty

    # Usuń pozycje z zerową ilością
    return {k: v for k, v in positions.items() if v["quantity"] > 0.001}


def _compute_cash(transactions: List[Transaction]) -> float:
    """Wylicza saldo gotówkowe."""
    cash = 0.0
    for tx in transactions:
        if tx.transaction_type == "deposit":
            cash += tx.amount_pln or 0
        elif tx.transaction_type == "withdrawal":
            cash -= tx.amount_pln or 0
        elif tx.transaction_type == "buy":
            cash -= tx.quantity * (tx.price_pln or tx.price or 0)
        elif tx.transaction_type == "sell":
            cash += tx.quantity * (tx.price_pln or tx.price or 0)
        elif tx.transaction_type == "dividend":
            cash += tx.price_pln or tx.price or 0
    return cash


# --- Portfolio Summary ---

def get_portfolio_summary(db: Session, portfolio_id: int, user_id: int) -> PortfolioSummary:
    portfolio = get_portfolio(db, portfolio_id, user_id)
    transactions = db.query(Transaction).filter(Transaction.portfolio_id == portfolio_id).all()

    cash_pln = _compute_cash(transactions)

    if not transactions:
        return PortfolioSummary(
            portfolio=portfolio,
            positions=[],
            total_value_pln=0,
            total_cost_pln=0,
            total_gain_loss_pln=0,
            total_gain_loss_pct=0,
            daily_change_pln=0,
            cash_pln=cash_pln,
        )

    raw_positions = _compute_positions(transactions)

    if not raw_positions:
        return PortfolioSummary(
            portfolio=portfolio,
            positions=[],
            total_value_pln=0,
            total_cost_pln=0,
            total_gain_loss_pln=0,
            total_gain_loss_pct=0,
            daily_change_pln=0,
            cash_pln=cash_pln,
        )

    # Pobierz ceny
    tickers_with_currency = [(p["ticker"], p["currency"]) for p in raw_positions.values()]
    prices = get_prices_batch(tickers_with_currency)

    enriched = []
    total_value = 0.0
    total_cost = 0.0
    total_daily = 0.0

    for ticker, pos in raw_positions.items():
        price_data = prices.get(ticker, {})
        current_price = price_data.get("price")
        fx_rate = price_data.get("fx_rate", 1.0)
        daily_pct = price_data.get("daily_change_pct")

        cost_pln = pos["total_cost_pln"]
        current_value_pln = None
        gain_loss_pln = None
        gain_loss_pct = None
        daily_change_pln = None
        current_price_pln = None

        if current_price is not None:
            current_price_pln = current_price * fx_rate
            current_value_pln = pos["quantity"] * current_price_pln
            gain_loss_pln = current_value_pln - cost_pln
            gain_loss_pct = (gain_loss_pln / cost_pln * 100) if cost_pln > 0 else 0
            daily_change_pln = current_value_pln * (daily_pct / 100) if daily_pct else 0
            total_value += current_value_pln
            total_daily += daily_change_pln

        total_cost += cost_pln

        enriched.append(PositionOut(
            ticker=ticker,
            name=pos.get("name"),              # ← NOWE
            asset_class=pos["asset_class"],
            currency=pos["currency"],
            quantity=pos["quantity"],
            avg_purchase_price=pos["avg_purchase_price"],
            avg_purchase_price_pln=pos["avg_purchase_price_pln"],
            first_purchase_date=pos["first_purchase_date"],
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
        cash_pln=cash_pln,
    )
