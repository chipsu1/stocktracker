from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict
import pandas as pd
import io
from datetime import datetime

from app.db.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.portfolio import Transaction
from app.services.portfolio_service import get_portfolio

router = APIRouter(prefix="/import", tags=["import"])

# Mapowanie typów XTB na typy transakcji w naszym systemie
DEPOSIT_TYPES = {'ike deposit', 'ike cash transfer in', 'deposit', 'transfer in', 'cash in'}
WITHDRAWAL_TYPES = {'ike cash transfer out', 'withdrawal', 'transfer out', 'cash out'}
DIVIDEND_TYPES = {'divident', 'dividend'}
INTEREST_TYPES = {'free-funds interest'}


def _find_header_row(df_raw: pd.DataFrame, keyword: str) -> int:
    for i, row in df_raw.iterrows():
        if keyword in str(row.values):
            return i
    return None


def _ticker_for_app(xtb_symbol) -> str:
    if pd.isna(xtb_symbol) or not xtb_symbol:
        return None
    s = str(xtb_symbol).strip().upper()
    if s.endswith(".PL"):
        return s[:-3] + ".WA"
    return s


def _parse_cash_operations(xl: pd.ExcelFile) -> List[Dict]:
    sheet = next((s for s in xl.sheet_names if "CASH" in s.upper()), None)
    if not sheet:
        return []

    raw = pd.read_excel(xl, sheet_name=sheet, header=None)
    header_row = _find_header_row(raw, "Type")
    if header_row is None:
        return []

    df = pd.read_excel(xl, sheet_name=sheet, header=header_row)
    df = df.dropna(subset=["Type"])
    df = df[df["Type"].astype(str).str.strip() != ""]

    results = []
    for _, row in df.iterrows():
        tx_type_raw = str(row.get("Type", "")).strip().lower()
        amount = row.get("Amount", None)
        time = row.get("Time", None)
        symbol = row.get("Symbol", None)
        comment = str(row.get("Comment", ""))

        if pd.isna(amount):
            continue

        amount = float(amount)
        tx_date = pd.Timestamp(time).to_pydatetime() if pd.notna(time) else datetime.utcnow()
        ticker = _ticker_for_app(symbol)

        if tx_type_raw in DEPOSIT_TYPES:
            results.append({
                "type": "deposit",
                "amount_pln": abs(amount),
                "date": tx_date,
                "notes": f"Import XTB: {row.get('Type', '')}",
            })

        elif tx_type_raw in WITHDRAWAL_TYPES:
            results.append({
                "type": "withdrawal",
                "amount_pln": abs(amount),
                "date": tx_date,
                "notes": f"Import XTB: {row.get('Type', '')}",
            })

        elif tx_type_raw in DIVIDEND_TYPES and ticker:
            results.append({
                "type": "dividend",
                "ticker": ticker,
                "amount_pln": abs(amount),
                "date": tx_date,
                "notes": comment,
            })

        elif tx_type_raw in INTEREST_TYPES:
            # Odsetki traktujemy jako wpłatę
            if amount > 0:
                results.append({
                    "type": "deposit",
                    "amount_pln": abs(amount),
                    "date": tx_date,
                    "notes": f"Import XTB: odsetki",
                })

        # Stock purchase i Stock sale pomijamy — bierzemy z OPEN POSITIONS

    return results


def _parse_open_positions(xl: pd.ExcelFile) -> List[Dict]:
    sheet = next((s for s in xl.sheet_names if "OPEN" in s.upper()), None)
    if not sheet:
        return []

    raw = pd.read_excel(xl, sheet_name=sheet, header=None)
    header_row = _find_header_row(raw, "Symbol")
    if header_row is None:
        return []

    df = pd.read_excel(xl, sheet_name=sheet, header=header_row)
    df = df.dropna(subset=["Symbol"])
    df = df[df["Symbol"].astype(str).str.contains(r"\.", na=False)]

    results = []
    for _, row in df.iterrows():
        ticker = _ticker_for_app(row["Symbol"])
        if not ticker:
            continue
        open_time = row.get("Open time")
        tx_date = pd.Timestamp(open_time).to_pydatetime() if pd.notna(open_time) else datetime.utcnow()

        results.append({
            "type": "buy",
            "ticker": ticker,
            "quantity": float(row["Volume"]),
            "price": float(row["Open price"]),
            "date": tx_date,
            "asset_class": "Akcje",
            "currency": "PLN",
        })

    return results


@router.post("/{portfolio_id}/xtb")
def import_xtb(
    portfolio_id: int,
    file: UploadFile = File(...),
    merge: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Importuje pełną historię operacji z pliku XTB (.xlsx):
    - Otwarte pozycje → transakcje BUY
    - Wpłaty/wypłaty → deposit/withdrawal
    - Dywidendy → dividend
    """
    get_portfolio(db, portfolio_id, current_user.id)

    if not file.filename.endswith(".xlsx"):
        raise HTTPException(400, "Plik musi być w formacie .xlsx")

    content = file.file.read()
    try:
        xl = pd.ExcelFile(io.BytesIO(content))
    except Exception:
        raise HTTPException(400, "Nie udało się odczytać pliku Excel")

    cash_ops = _parse_cash_operations(xl)
    open_positions = _parse_open_positions(xl)

    if not cash_ops and not open_positions:
        raise HTTPException(400, "Brak danych do importu w pliku")

    imported = {"buy": 0, "deposit": 0, "withdrawal": 0, "dividend": 0}

    # Importuj operacje gotówkowe
    for op in cash_ops:
        tx = Transaction(
            portfolio_id=portfolio_id,
            transaction_type=op["type"],
            ticker=op.get("ticker"),
            amount_pln=op.get("amount_pln"),
            price=op.get("amount_pln") if op["type"] == "dividend" else None,
            price_pln=op.get("amount_pln") if op["type"] == "dividend" else None,
            date=op["date"],
            notes=op.get("notes", "Import XTB"),
        )
        db.add(tx)
        imported[op["type"]] = imported.get(op["type"], 0) + 1

    # Importuj otwarte pozycje jako zakupy
    for pos in open_positions:
        tx = Transaction(
            portfolio_id=portfolio_id,
            transaction_type="buy",
            ticker=pos["ticker"],
            asset_class=pos.get("asset_class", "Akcje"),
            currency=pos.get("currency", "PLN"),
            quantity=pos["quantity"],
            price=pos["price"],
            price_pln=pos["price"],
            exchange_rate=1.0,
            date=pos["date"],
            notes="Import XTB - otwarta pozycja",
        )
        db.add(tx)
        imported["buy"] += 1

    db.commit()

    return {
        "imported": imported,
        "total_imported": sum(imported.values()),
    }
