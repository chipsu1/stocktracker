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


def _to_dt(val) -> datetime:
    try:
        return pd.Timestamp(val).to_pydatetime()
    except Exception:
        return datetime.utcnow()


def _get_cash_balance(xl: pd.ExcelFile) -> float:
    """
    Pobiera aktualny balans gotówki z nagłówka pliku XTB.
    To jest suma wszystkich operacji cash (wpłaty - zakupy + sprzedaże + dywidendy itd.)
    """
    sheet = next((s for s in xl.sheet_names if "CASH" in s.upper()), None)
    if not sheet:
        return 0.0
    raw = pd.read_excel(xl, sheet_name=sheet, header=None)
    # Balans jest w nagłówku — szukamy wiersza z "Balance"
    for i, row in raw.iterrows():
        if "Balance" in str(row.values):
            # Następny wiersz ma wartość
            next_row = raw.iloc[i + 1]
            for val in next_row.values:
                try:
                    if pd.notna(val) and isinstance(val, (int, float)):
                        return float(val)
                except Exception:
                    pass
    return 0.0


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
        tx_date = _to_dt(open_time) if pd.notna(open_time) else datetime.utcnow()
        purchase_value = float(row.get("Purchase value", 0) or 0)
        comment = str(row.get("Comment", "") or "").strip()

        results.append({
            "type": "buy",
            "ticker": ticker,
            "quantity": float(row["Volume"]),
            "price": float(row["Open price"]),
            "purchase_value": purchase_value,
            "date": tx_date,
            "asset_class": "Akcje",
            "currency": "PLN",
            "comment": comment,
        })

    return results


def _get_dividends(xl: pd.ExcelFile) -> List[Dict]:
    sheet = next((s for s in xl.sheet_names if "CASH" in s.upper()), None)
    if not sheet:
        return []
    raw = pd.read_excel(xl, sheet_name=sheet, header=None)
    header_row = _find_header_row(raw, "Type")
    if header_row is None:
        return []
    df = pd.read_excel(xl, sheet_name=sheet, header=header_row)
    df = df.dropna(subset=["Type"])

    results = []
    for _, row in df.iterrows():
        t = str(row.get("Type", "")).strip().lower()
        if t == "divident":
            amt = row.get("Amount", 0)
            if pd.notna(amt) and float(amt) > 0:
                ticker = _ticker_for_app(row.get("Symbol"))
                results.append({
                    "ticker": ticker,
                    "amount_pln": float(amt),
                    "date": _to_dt(row.get("Time")),
                    "notes": str(row.get("Comment", "") or ""),
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
    Importuje dane z pliku XTB (.xlsx):
    1. Otwarte pozycje → transakcje BUY
    2. Aktualny balans gotówki → jedna wpłata (żeby saldo się zgadzało)
    3. Dywidendy → transakcje DIVIDEND
    """
    get_portfolio(db, portfolio_id, current_user.id)

    if not file.filename.endswith(".xlsx"):
        raise HTTPException(400, "Plik musi być w formacie .xlsx")

    content = file.file.read()
    try:
        xl = pd.ExcelFile(io.BytesIO(content))
    except Exception:
        raise HTTPException(400, "Nie udało się odczytać pliku Excel")

    open_positions = _parse_open_positions(xl)
    dividends = _get_dividends(xl)

    # Wylicz łączną wartość otwartych pozycji
    total_positions_value = sum(p["purchase_value"] for p in open_positions)

    # Pobierz aktualny balans gotówki z nagłówka pliku
    cash_balance = _get_cash_balance(xl)

    # Kwota wpłaty = wartość pozycji + balans gotówki
    # Bo: wpłata - zakupy = balans → wpłata = zakupy + balans
    deposit_amount = total_positions_value + cash_balance

    imported = {"buy": 0, "deposit": 0, "dividend": 0}

    # Jedna wpłata startowa reprezentująca całą historię
    if deposit_amount > 0:
        db.add(Transaction(
            portfolio_id=portfolio_id,
            transaction_type="deposit",
            amount_pln=round(deposit_amount, 2),
            date=datetime(2025, 4, 14),  # Data pierwszego importu STC
            notes="Import XTB: saldo historyczne",
        ))
        imported["deposit"] += 1

    # Otwarte pozycje jako zakupy
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
            notes=f"Import XTB - {pos.get('comment', 'otwarta pozycja')}",
        )
        db.add(tx)
        imported["buy"] += 1

    # Dywidendy
    for div in dividends:
        tx = Transaction(
            portfolio_id=portfolio_id,
            transaction_type="dividend",
            ticker=div["ticker"],
            price=div["amount_pln"],
            price_pln=div["amount_pln"],
            amount_pln=div["amount_pln"],
            date=div["date"],
            notes=div["notes"] or "Import XTB: dywidenda",
        )
        db.add(tx)
        imported["dividend"] += 1

    db.commit()

    return {
        "imported": imported,
        "total_imported": sum(imported.values()),
        "cash_balance": cash_balance,
        "deposit_amount": round(deposit_amount, 2),
    }
