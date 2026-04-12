from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
import pandas as pd
import io
from datetime import datetime
from typing import Optional

from app.db.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.portfolio import Portfolio, Transaction
from app.services.portfolio_service import get_portfolio

router = APIRouter(prefix="/import", tags=["import"])

TRANSACTION_TYPE_MAP = {
    "zakup":                    "buy",
    "sprzedaż":                 "sell",
    "sprzedaz":                 "sell",
    "dywidenda":                "dividend",
    "dywidenda / odsetki":      "dividend",
    "wpłata środków":           "deposit",
    "wplata srodkow":           "deposit",
    "wpłata":                   "deposit",
    "wypłata środków":          "withdrawal",
    "wyplata srodkow":          "withdrawal",
    "wypłata":                  "withdrawal",
    "split akcji":              "split",
    "split":                    "split",
}


def _parse_type(val: str) -> Optional[str]:
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
    except Exception:
        pass
    try:
        cleaned = (
            str(val)
            .replace("zł", "").replace("PLN", "")
            .replace("\xa0", "").replace("\u202f", "")
            .replace(" ", "").replace(",", ".")
            .strip()
        )
        return float(cleaned) if cleaned else default
    except Exception:
        return default


def _get_or_create_portfolio(db: Session, user_id: int, name: str) -> Portfolio:
    """Zwraca istniejący portfel o danej nazwie lub tworzy nowy."""
    portfolio = db.query(Portfolio).filter(
        Portfolio.user_id == user_id,
        Portfolio.name == name,
    ).first()
    if not portfolio:
        portfolio = Portfolio(
            user_id=user_id,
            name=name,
            description=f"Zaimportowano z arkusza Google",
            currency="PLN",
        )
        db.add(portfolio)
        db.flush()  # żeby dostać id bez commita
    return portfolio


@router.post("/multi-gsheet")
def import_multi_gsheet(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Importuje plik Excel z arkusza Google z kolumną 'Konto'.
    Automatycznie tworzy portfele per konto i rozdziela transakcje.
    """
    filename = file.filename.lower()
    content = file.file.read()

    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
        elif filename.endswith((".xlsx", ".xls")):
            # Znajdź zakładkę Transakcje
            xl = pd.ExcelFile(io.BytesIO(content))
            sheet_name = next(
                (s for s in xl.sheet_names if "transakcje" in s.lower()),
                xl.sheet_names[0]
            )
            # Znajdź wiersz nagłówkowy
            raw = pd.read_excel(io.BytesIO(content), sheet_name=sheet_name, header=None)
            header_row = None
            for i, row in raw.iterrows():
                vals = [str(v).strip() for v in row.values]
                if "Konto" in vals and "Rodzaj transakcji" in vals:
                    header_row = i
                    break
            if header_row is None:
                raise HTTPException(400, "Nie znaleziono wiersza nagłówkowego z kolumnami 'Konto' i 'Rodzaj transakcji'")
            df = pd.read_excel(io.BytesIO(content), sheet_name=sheet_name, header=header_row)
        else:
            raise HTTPException(400, "Plik musi być w formacie .csv lub .xlsx")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f"Nie udało się odczytać pliku: {str(e)}")

    # Normalizuj nagłówki
    df.columns = [str(c).strip().lstrip("\ufeff") for c in df.columns]

    if "Konto" not in df.columns:
        raise HTTPException(400, "Brak kolumny 'Konto' w pliku")
    if "Rodzaj transakcji" not in df.columns:
        raise HTTPException(400, "Brak kolumny 'Rodzaj transakcji' w pliku")

    # Zbierz statystyki
    portfolios_created = []
    portfolios_existing = []
    imported_per_portfolio = {}
    skipped = 0

    # Cache portfeli żeby nie odpytywać DB wielokrotnie
    portfolio_cache = {}

    for _, row in df.iterrows():
        konto = str(row.get("Konto", "") or "").strip()
        if not konto or konto == "nan":
            skipped += 1
            continue

        tx_type = _parse_type(str(row.get("Rodzaj transakcji", "")))
        if not tx_type:
            skipped += 1
            continue

        # Pobierz lub utwórz portfel
        if konto not in portfolio_cache:
            existing = db.query(Portfolio).filter(
                Portfolio.user_id == current_user.id,
                Portfolio.name == konto,
            ).first()
            if existing:
                portfolio_cache[konto] = existing
                if konto not in portfolios_existing:
                    portfolios_existing.append(konto)
            else:
                new_p = Portfolio(
                    user_id=current_user.id,
                    name=konto,
                    description="Zaimportowano z arkusza Google",
                    currency="PLN",
                )
                db.add(new_p)
                db.flush()
                portfolio_cache[konto] = new_p
                portfolios_created.append(konto)

        portfolio = portfolio_cache[konto]

        ticker = str(row.get("Ticker", "") or "").strip().upper() or None
        nazwa = str(row.get("Nazwa", "") or "").strip() or None
        asset_class = str(row.get("Klasa aktywów", "Akcje") or "Akcje").strip()
        currency = str(row.get("Waluta", "PLN") or "PLN").strip()
        quantity = _safe_float(row.get("Liczba"))
        price = _safe_float(row.get("Cena"))
        exchange_rate = _safe_float(row.get("Kurs PLN transakcji"), default=1.0)
        amount_pln = _safe_float(row.get("Total PLN")) or _safe_float(row.get("Cena nominalna"))

        # Dla dywidendy – kwota całkowita to Total PLN, nie Cena jednostkowa
        if tx_type == "dividend":
            price = amount_pln or price
            # amount_pln już jest ustawione z Total PLN

        # Deposit/withdrawal – wyczyść ticker
        if tx_type in ("deposit", "withdrawal"):
            if not amount_pln:
                skipped += 1
                continue
            ticker = None
            nazwa = None

        db.add(Transaction(
            portfolio_id=portfolio.id,
            transaction_type=tx_type,
            ticker=ticker,
            name=nazwa,
            asset_class=asset_class,
            currency=currency,
            quantity=quantity,
            price=price,
            price_pln=price * exchange_rate if price and exchange_rate else None,
            exchange_rate=exchange_rate,
            amount_pln=amount_pln,
            date=_to_dt(row.get("Data")),
            notes="Import Multi-GSheet",
        ))

        if konto not in imported_per_portfolio:
            imported_per_portfolio[konto] = 0
        imported_per_portfolio[konto] += 1

    db.commit()

    total_imported = sum(imported_per_portfolio.values())

    return {
        "total_imported": total_imported,
        "skipped": skipped,
        "portfolios_created": portfolios_created,
        "portfolios_existing": portfolios_existing,
        "imported_per_portfolio": imported_per_portfolio,
    }
