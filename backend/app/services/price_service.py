import yfinance as yf
import requests
import pandas as pd
from typing import Optional, Dict, Tuple
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# Cache w pamięci (TTL ~5 min) — możesz później zastąpić Redis
_price_cache: Dict[str, Tuple[float, float, datetime]] = {}
_fx_cache: Dict[str, Tuple[float, datetime]] = {}
CACHE_TTL_SECONDS = 300


def _is_cache_valid(cached_time: datetime) -> bool:
    delta = (datetime.utcnow() - cached_time).total_seconds()
    return delta < CACHE_TTL_SECONDS


# --- Kursy walut NBP ---
def get_fx_rate_pln(currency: str) -> float:
    """Pobiera kurs waluty do PLN z NBP API."""
    if currency == "PLN":
        return 1.0

    currency = currency.upper()

    if currency in _fx_cache:
        rate, cached_at = _fx_cache[currency]
        if _is_cache_valid(cached_at):
            return rate

    try:
        url = f"https://api.nbp.pl/api/exchangerates/rates/a/{currency}/?format=json"
        resp = requests.get(url, timeout=5)
        resp.raise_for_status()
        rate = resp.json()["rates"][0]["mid"]
        _fx_cache[currency] = (rate, datetime.utcnow())
        return rate
    except Exception as e:
        logger.warning(f"NBP FX fetch failed for {currency}: {e}")
        # Fallback na yfinance
        try:
            ticker = yf.Ticker(f"{currency}PLN=X")
            hist = ticker.history(period="1d")
            if not hist.empty:
                rate = float(hist["Close"].iloc[-1])
                _fx_cache[currency] = (rate, datetime.utcnow())
                return rate
        except Exception:
            pass
        return 1.0


# --- Ceny akcji: GPW (Stooq) ---
def _fetch_stooq(ticker: str) -> Optional[Tuple[float, float]]:
    """
    Pobiera cenę z Stooq dla akcji GPW.
    Zwraca (current_price, daily_change_pct) lub None.
    Ticker GPW: np. "PKN" → "pkn.pl"
    """
    stooq_ticker = ticker.lower()
    if not stooq_ticker.endswith(".pl"):
        stooq_ticker = stooq_ticker + ".pl"

    url = f"https://stooq.pl/q/l/?s={stooq_ticker}&f=sd2t2ohlcv&h&e=csv"
    try:
        resp = requests.get(url, timeout=8)
        resp.raise_for_status()
        lines = resp.text.strip().split("\n")
        if len(lines) < 2:
            return None
        parts = lines[1].split(",")
        # Format: Symbol,Date,Time,Open,High,Low,Close,Volume
        if len(parts) < 7 or parts[6] in ("N/D", ""):
            return None
        close = float(parts[6])
        open_ = float(parts[3]) if parts[3] not in ("N/D", "") else close
        daily_change_pct = ((close - open_) / open_ * 100) if open_ > 0 else 0.0
        return close, daily_change_pct
    except Exception as e:
        logger.warning(f"Stooq fetch failed for {stooq_ticker}: {e}")
        return None


# --- Ceny akcji: yfinance (USA/EU) ---
def _fetch_yfinance(ticker: str) -> Optional[Tuple[float, float]]:
    """Pobiera cenę z yfinance. Zwraca (current_price, daily_change_pct)."""
    try:
        t = yf.Ticker(ticker)
        info = t.fast_info
        current = float(info.last_price)
        prev_close = float(info.previous_close) if info.previous_close else current
        daily_change_pct = ((current - prev_close) / prev_close * 100) if prev_close > 0 else 0.0
        return current, daily_change_pct
    except Exception as e:
        logger.warning(f"yfinance fetch failed for {ticker}: {e}")
        return None


# --- Główna funkcja ---
def get_price(ticker: str, currency: str = "PLN") -> Dict:
    """
    Pobiera aktualną cenę aktywa.
    Automatycznie wybiera źródło:
      - GPW (.pl, WSE:): Stooq
      - reszta: yfinance
    Zwraca dict z: price, daily_change_pct, price_pln, fx_rate
    """
    cache_key = ticker.upper()

    if cache_key in _price_cache:
        price, daily_pct, cached_at = _price_cache[cache_key]
        if _is_cache_valid(cached_at):
            fx_rate = get_fx_rate_pln(currency)
            return {
                "ticker": ticker,
                "price": price,
                "daily_change_pct": daily_pct,
                "currency": currency,
                "fx_rate": fx_rate,
                "price_pln": price * fx_rate,
                "cached": True,
            }

    result = None

    # Wykryj GPW
    is_gpw = (
        ticker.upper().startswith("WSE:")
        or ticker.endswith(".pl")
        or ticker.endswith(".PL")
    )

    if is_gpw:
        clean = ticker.upper().replace("WSE:", "")
        result = _fetch_stooq(clean)

    if result is None:
        result = _fetch_yfinance(ticker)

    if result is None:
        return {
            "ticker": ticker,
            "price": None,
            "daily_change_pct": None,
            "currency": currency,
            "fx_rate": get_fx_rate_pln(currency),
            "price_pln": None,
            "error": "Nie udało się pobrać ceny",
        }

    price, daily_pct = result
    _price_cache[cache_key] = (price, daily_pct, datetime.utcnow())

    fx_rate = get_fx_rate_pln(currency)
    return {
        "ticker": ticker,
        "price": price,
        "daily_change_pct": daily_pct,
        "currency": currency,
        "fx_rate": fx_rate,
        "price_pln": price * fx_rate,
        "cached": False,
    }


def get_prices_batch(tickers_with_currency: list) -> Dict:
    """Pobiera ceny dla listy [(ticker, currency), ...]"""
    results = {}
    for ticker, currency in tickers_with_currency:
        results[ticker] = get_price(ticker, currency)
    return results
