from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.db.database import Base


class AssetClass(str, enum.Enum):
    STOCK_PL = "Akcje polskie"
    STOCK_FOREIGN = "Akcje zagraniczne"
    BOND_PL = "Obligacje skarbowe polskie"
    BOND_FOREIGN = "Obligacje skarbowe zagraniczne"
    BOND_CORP_PL = "Obligacje korporacyjne polskie"
    ETF = "ETF"
    CASH = "Gotówka"
    CURRENCY = "Waluty"
    OTHER = "Inne"


class TransactionType(str, enum.Enum):
    BUY = "buy"
    SELL = "sell"
    DIVIDEND = "dividend"


class Portfolio(Base):
    __tablename__ = "portfolios"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    currency = Column(String, default="PLN")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="portfolios")
    positions = relationship("Position", back_populates="portfolio", cascade="all, delete-orphan")


class Position(Base):
    __tablename__ = "positions"

    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"), nullable=False)
    ticker = Column(String, nullable=False)
    name = Column(String, nullable=True)
    asset_class = Column(String, default=AssetClass.STOCK_FOREIGN)
    currency = Column(String, default="PLN")
    quantity = Column(Float, nullable=False, default=0)
    avg_purchase_price = Column(Float, nullable=False, default=0)
    avg_purchase_price_pln = Column(Float, nullable=True)
    exchange_rate_at_purchase = Column(Float, nullable=True, default=1.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    purchase_date = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    portfolio = relationship("Portfolio", back_populates="positions")
    transactions = relationship("Transaction", back_populates="position", cascade="all, delete-orphan")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    position_id = Column(Integer, ForeignKey("positions.id"), nullable=False)
    transaction_type = Column(String, nullable=False)
    quantity = Column(Float, nullable=False)
    price = Column(Float, nullable=False)
    price_pln = Column(Float, nullable=True)
    exchange_rate = Column(Float, default=1.0)
    date = Column(DateTime(timezone=True), server_default=func.now())
    notes = Column(String, nullable=True)

    position = relationship("Position", back_populates="transactions")
