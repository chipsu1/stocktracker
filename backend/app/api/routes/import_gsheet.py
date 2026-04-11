from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
import pandas as pd
import io
from datetime import datetime

from app.db.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.portfolio import Transaction
from app.services.portfolio_service import get_portfolio

router = APIRouter(prefix="/import", tags=["import"])

TRANSACTION_TYPE_MAP = {
    "zakup":            "buy",
    "sprzedaż":         "sell",
    "sprzedaz":         "sell",
    "dywidenda":        "dividend",
    "wpłata środków":   "deposit",
    "wplata srodkow":   "deposit",
    "wpłata":           "deposit",
    "wypłata środków":  "withdrawal",
    "wyplata srodkow":  "withdrawal",
    "wypłata":          "withdrawal",
    "split akcji":      "split",
    "split":            "split",
}

REQUIRED_COLUMNS = {"Data", "Rodzaj transakcji"}


def _parse_transaction_type(val: str) -> str:
    return TRANSACTION_TYPE_MAP.get(str(val).strip().lower())


def _to_dt(val) -> datetime:
    try:
        return pd.Timestamp(val).to_pydatetime()
    except Exception:
        return datetime.utcnow()


def _safe_float(val, default=None):
    try:
        if pd.isna(val):
            return default
        return float(val)
    except Exception:
        return default


@router.post("/{portfolio_id}/gsheet")
def import_gsheet(
    portfolio_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_portfolio(db, portfolio_id, current_user.id)

    filename = file.filename.lower()
    content = file.file.read()

    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
        elif filename.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(content), sheet_name='Transakcje')
        else:
            raise HTTPException(400, "Plik musi być w formacie .csv lub .xlsx")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(400, "Nie udało się odczytać pliku")

    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise HTTPException(400, f"Brakujące kolumny: {', '.join(missing)}")

    imported = {"buy": 0, "sell": 0, "dividend": 0, "deposit": 0,
                "withdrawal": 0, "split": 0, "skipped": 0}

    for _, row in df.iterrows():
        tx_type = _parse_transaction_type(str(row.get("Rodzaj transakcji", "")))
        if not tx_type:
            imported["skipped"] += 1
            continue

        ticker = str(row.get("Ticker", "") or "").strip().upper() or None
        asset_class = str(row.get("Klasa aktywów", "Akcje") or "Akcje").strip()
        currency = str(row.get("Waluta", "PLN") or "PLN").strip()
        quantity = _safe_float(row.get("Liczba"))
        price = _safe_float(row.get("Cena"))
        exchange_rate = _safe_float(row.get("Kurs PLN transakcji"), default=1.0)
        amount_pln = _safe_float(row.get("Total PLN"))
        nazwa = str(row.get("Nazwa", "") or "").strip()

        db.add(Transaction(
            portfolio_id=portfolio_id,
            transaction_type=tx_type,
            ticker=ticker,
            asset_class=asset_class,
            currency=currency,
            quantity=quantity,
            price=price,
            price_pln=price * exchange_rate if price and exchange_rate else None,
            exchange_rate=exchange_rate,
            amount_pln=amount_pln,
            date=_to_dt(row.get("Data")),
            notes=f"Import GSheet{' - ' + nazwa if nazwa else ''}",
        ))
        imported[tx_type] = imported.get(tx_type, 0) + 1

    db.commit()

    return {
        "imported": imported,
        "total_imported": sum(v for k, v in imported.items() if k != "skipped"),
    }
