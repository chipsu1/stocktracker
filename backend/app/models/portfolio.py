from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.database import Base


class Portfolio(Base):
    __tablename__ = "portfolios"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    currency = Column(String, default="PLN")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="portfolios")
    transactions = relationship("Transaction", back_populates="portfolio", cascade="all, delete-orphan")


class Transaction(Base):
    """
    Typy transakcji:
      buy        - zakup (ticker, quantity, price, currency)
      sell       - sprzedaż (ticker, quantity, price, currency)
      dividend   - dywidenda (ticker, price=kwota całkowita)
      split      - split akcji (ticker, quantity=nowa liczba akcji)
      deposit    - wpłata gotówki (amount_pln)
      withdrawal - wypłata gotówki (amount_pln)
    """
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"), nullable=False)
    transaction_type = Column(String, nullable=False)

    # Dla buy/sell/dividend/split
    ticker = Column(String, nullable=True)
    name = Column(String, nullable=True)           # ← NOWE: pełna nazwa spółki
    asset_class = Column(String, nullable=True, default="Akcje")
    currency = Column(String, nullable=True, default="PLN")
    quantity = Column(Float, nullable=True)
    price = Column(Float, nullable=True)           # cena jednostkowa
    price_pln = Column(Float, nullable=True)       # cena jednostkowa w PLN
    exchange_rate = Column(Float, nullable=True, default=1.0)

    # Dla deposit/withdrawal
    amount_pln = Column(Float, nullable=True)

    date = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    notes = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    portfolio = relationship("Portfolio", back_populates="transactions")
