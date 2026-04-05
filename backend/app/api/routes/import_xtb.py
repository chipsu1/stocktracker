"""
Wklej ten plik jako: backend/app/api/routes/import_xtb.py
"""

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict
import pandas as pd
import io

from app.db.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.portfolio import Portfolio, Transaction
from app.services.portfolio_service import get_portfolio

router = APIRouter(prefix="/import", tags=["import"])


def _find_header_row(df_raw: pd.DataFrame, keyword: str) -> int:
    for i, row in df_raw.iterrows():
        if keyword in str(row.values):
            return i
    return None


def _parse_open_positions(xl: pd.ExcelFile) -> pd.DataFrame:
    # Znajdź arkusz z otwartymi pozycjami
    sheet = next((s for s in xl.sheet_names if "OPEN" in s.upper()), None)
    if not sheet:
        return pd.DataFrame()
    raw = pd.read_excel(xl, sheet_name=sheet, header=None)
    header_row = _find_header_row(raw, "Symbol")
    if header_row is None:
        return pd.DataFrame()
    df = pd.read_excel(xl, sheet_name=sheet, header=header_row)
    df = df.dropna(subset=["Symbol"])
    df = df[df["Symbol"].astype(str).str.contains(r"\.", na=False)]  # usuń "Total" itp.
    return df


def _ticker_for_app(xtb_symbol: str) -> str:
    """Konwertuje XTB symbol (ELT.PL) na format yfinance (ELT.WA)"""
    if xtb_symbol.upper().endswith(".PL"):
        base = xtb_symbol[:-3]
        return f"{base}.WA"
    return xtb_symbol


def _merge_positions(df: pd.DataFrame) -> List[Dict]:
    """Grupuje pozycje po tickerze (średnia ważona ceny, suma wolumenu)."""
    grouped = {}
    for _, row in df.iterrows():
        symbol = str(row["Symbol"]).strip()
        ticker = _ticker_for_app(symbol)
        volume = float(row["Volume"])
        open_price = float(row["Open price"])
        open_time = row["Open time"]

        if ticker not in grouped:
            grouped[ticker] = {
                "ticker": ticker,
                "total_volume": 0,
                "total_cost": 0,
                "earliest_date": open_time,
            }

        grouped[ticker]["total_volume"] += volume
        grouped[ticker]["total_cost"] += volume * open_price
        if pd.notna(open_time) and (
            pd.isna(grouped[ticker]["earliest_date"])
            or open_time < grouped[ticker]["earliest_date"]
        ):
            grouped[ticker]["earliest_date"] = open_time

    result = []
    for ticker, data in grouped.items():
        avg_price = data["total_cost"] / data["total_volume"] if data["total_volume"] > 0 else 0
        result.append({
            "ticker": ticker,
            "quantity": round(data["total_volume"], 6),
            "avg_purchase_price": round(avg_price, 4),
            "purchase_date": data["earliest_date"] if pd.notna(data["earliest_date"]) else None,
            "asset_class": "Akcje",
            "currency": "PLN",
        })
    return result


@router.post("/{portfolio_id}/xtb")
def import_xtb(
    portfolio_id: int,
    file: UploadFile = File(...),
    merge: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Importuje otwarte pozycje z pliku XTB (.xlsx).
    merge=true → grupuje wiele pozycji tego samego tickera w jedną (średnia ważona)
    merge=false → importuje każdą linię osobno
    """
    get_portfolio(db, portfolio_id, current_user.id)  # sprawdź dostęp

    if not file.filename.endswith(".xlsx"):
        raise HTTPException(400, "Plik musi być w formacie .xlsx")

    content = file.file.read()
    try:
        xl = pd.ExcelFile(io.BytesIO(content))
    except Exception:
        raise HTTPException(400, "Nie udało się odczytać pliku Excel")

    df = _parse_open_positions(xl)
    if df.empty:
        raise HTTPException(400, "Brak otwartych pozycji w pliku")

    if merge:
        positions_to_import = _merge_positions(df)
    else:
        positions_to_import = []
        for _, row in df.iterrows():
            ticker = _ticker_for_app(str(row["Symbol"]).strip())
            positions_to_import.append({
                "ticker": ticker,
                "quantity": float(row["Volume"]),
                "avg_purchase_price": float(row["Open price"]),
                "purchase_date": row["Open time"] if pd.notna(row["Open time"]) else None,
                "asset_class": "Akcje",
                "currency": "PLN",
            })

    imported = []
    skipped = []

    for p in positions_to_import:


        purchase_date = p["purchase_date"]
        if pd.notna(purchase_date) if not isinstance(purchase_date, type(None)) else False:
            try:
                purchase_date = pd.Timestamp(purchase_date).to_pydatetime()
            except Exception:
                purchase_date = None

        position = Position(
            portfolio_id=portfolio_id,
            ticker=p["ticker"],
            asset_class=p["asset_class"],
            currency=p["currency"],
            quantity=p["quantity"],
            avg_purchase_price=p["avg_purchase_price"],
            avg_purchase_price_pln=p["avg_purchase_price"],  # PLN więc 1:1
            exchange_rate_at_purchase=1.0,
            purchase_date=purchase_date,
        )
        db.add(position)
        imported.append(p["ticker"])

    db.commit()

    return {
        "imported": imported,
        "skipped": skipped,
        "total_imported": len(imported),
        "total_skipped": len(skipped),
    }
