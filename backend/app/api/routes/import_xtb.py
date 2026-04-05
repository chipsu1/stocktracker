from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict
import pandas as pd
import io

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


def _parse_open_positions(xl: pd.ExcelFile) -> pd.DataFrame:
    sheet = next((s for s in xl.sheet_names if "OPEN" in s.upper()), None)
    if not sheet:
        return pd.DataFrame()
    raw = pd.read_excel(xl, sheet_name=sheet, header=None)
    header_row = _find_header_row(raw, "Symbol")
    if header_row is None:
        return pd.DataFrame()
    df = pd.read_excel(xl, sheet_name=sheet, header=header_row)
    df = df.dropna(subset=["Symbol"])
    df = df[df["Symbol"].astype(str).str.contains(r"\.", na=False)]
    return df


def _ticker_for_app(xtb_symbol: str) -> str:
    if xtb_symbol.upper().endswith(".PL"):
        base = xtb_symbol[:-3]
        return f"{base}.WA"
    return xtb_symbol


def _merge_positions(df: pd.DataFrame) -> List[Dict]:
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
            "price": round(avg_price, 4),
            "date": data["earliest_date"] if pd.notna(data["earliest_date"]) else None,
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
    get_portfolio(db, portfolio_id, current_user.id)

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
        items = _merge_positions(df)
    else:
        items = []
        for _, row in df.iterrows():
            ticker = _ticker_for_app(str(row["Symbol"]).strip())
            open_time = row["Open time"]
            items.append({
                "ticker": ticker,
                "quantity": float(row["Volume"]),
                "price": float(row["Open price"]),
                "date": open_time if pd.notna(open_time) else None,
                "asset_class": "Akcje",
                "currency": "PLN",
            })

    imported = []

    for p in items:
        tx_date = None
        if p["date"] is not None:
            try:
                tx_date = pd.Timestamp(p["date"]).to_pydatetime()
            except Exception:
                tx_date = None

        tx = Transaction(
            portfolio_id=portfolio_id,
            transaction_type="buy",
            ticker=p["ticker"],
            asset_class=p["asset_class"],
            currency=p["currency"],
            quantity=p["quantity"],
            price=p["price"],
            price_pln=p["price"],  # PLN więc 1:1
            exchange_rate=1.0,
            date=tx_date,
            notes="Import XTB",
        )
        db.add(tx)
        imported.append(p["ticker"])

    db.commit()

    return {
        "imported": imported,
        "total_imported": len(imported),
    }
