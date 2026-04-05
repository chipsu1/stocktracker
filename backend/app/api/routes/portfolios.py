from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.portfolio import (
    PortfolioCreate, PortfolioUpdate, PortfolioOut,
    PositionCreate, PositionUpdate, PositionOut,
    TransactionCreate, TransactionOut, PortfolioSummary
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


@router.get("/{portfolio_id}/summary", response_model=PortfolioSummary)
def get_portfolio_summary(
    portfolio_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return portfolio_service.get_portfolio_summary(db, portfolio_id, current_user.id)


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


# --- Positions ---

@router.get("/{portfolio_id}/positions", response_model=List[PositionOut])
def list_positions(
    portfolio_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return portfolio_service.get_positions(db, portfolio_id, current_user.id)


@router.post("/{portfolio_id}/positions", response_model=PositionOut, status_code=201)
def create_position(
    portfolio_id: int,
    data: PositionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return portfolio_service.create_position(db, portfolio_id, current_user.id, data)


@router.put("/positions/{position_id}", response_model=PositionOut)
def update_position(
    position_id: int,
    data: PositionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return portfolio_service.update_position(db, position_id, current_user.id, data)


@router.delete("/positions/{position_id}", status_code=204)
def delete_position(
    position_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    portfolio_service.delete_position(db, position_id, current_user.id)


# --- Transactions ---

@router.post("/positions/{position_id}/transactions", response_model=TransactionOut, status_code=201)
def add_transaction(
    position_id: int,
    data: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return portfolio_service.add_transaction(db, position_id, current_user.id, data)
