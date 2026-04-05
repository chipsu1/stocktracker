from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.portfolio import (
    PortfolioCreate, PortfolioUpdate, PortfolioOut,
    TransactionCreate, TransactionOut,
    PortfolioSummary,
)
from app.services import portfolio_service

router = APIRouter(prefix="/portfolios", tags=["portfolios"])


# --- Portfolios ---

@router.get("/", response_model=List[PortfolioOut])
def list_portfolios(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return portfolio_service.get_user_portfolios(db, current_user.id)


@router.post("/", response_model=PortfolioOut, status_code=201)
def create_portfolio(
    data: PortfolioCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return portfolio_service.create_portfolio(db, current_user.id, data)


@router.get("/{portfolio_id}", response_model=PortfolioOut)
def get_portfolio(
    portfolio_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return portfolio_service.get_portfolio(db, portfolio_id, current_user.id)


@router.put("/{portfolio_id}", response_model=PortfolioOut)
def update_portfolio(
    portfolio_id: int,
    data: PortfolioUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return portfolio_service.update_portfolio(db, portfolio_id, current_user.id, data)


@router.delete("/{portfolio_id}", status_code=204)
def delete_portfolio(
    portfolio_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    portfolio_service.delete_portfolio(db, portfolio_id, current_user.id)


@router.get("/{portfolio_id}/summary", response_model=PortfolioSummary)
def get_portfolio_summary(
    portfolio_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return portfolio_service.get_portfolio_summary(db, portfolio_id, current_user.id)


# --- Transactions ---

@router.get("/{portfolio_id}/transactions", response_model=List[TransactionOut])
def list_transactions(
    portfolio_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return portfolio_service.get_transactions(db, portfolio_id, current_user.id)


@router.post("/{portfolio_id}/transactions", response_model=TransactionOut, status_code=201)
def add_transaction(
    portfolio_id: int,
    data: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return portfolio_service.add_transaction(db, portfolio_id, current_user.id, data)


@router.delete("/transactions/{transaction_id}", status_code=204)
def delete_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    portfolio_service.delete_transaction(db, transaction_id, current_user.id)
