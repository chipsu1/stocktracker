import yfinance as yf
import requests
from typing import Optional, Dict, Tuple
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

_price_cache: Dict[str, Tuple[float, float, datetime]] = {}
_fx_cache: Dict[str, Tuple[float, datetime]] = {}
CACHE_TTL_SECONDS = 300


def _is_cache_valid(cached_time: datetime) -> bool:
    return (datetime.utcnow() - cached_time).total_seconds() < CACHE_TTL_SECONDS


def get_fx_rate_pln(currency: str) -> float:
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
        try:
            t = yf.Ticker(f"{currency}PLN=X")
            hist = t.history(period="5d", auto_adjust=True)
            if not hist.empty:
                rate = float(hist["Close"].iloc[-1])
                _fx_cache[currency] = (rate, datetime.utcnow())
                return rate
        except Exception:
            pass
        return 1.0


def _fetch_stooq(ticker: str) -> Optional[Tuple[float, float]]:
    """Pobiera ostatnie zamknięcie z Stooq — dla akcji GPW."""
    clean = ticker.upper().replace("WSE:", "").replace(".WA", "").replace(".PL", "").replace(".pl", "")
    stooq_ticker = clean.lower() + ".pl"
    url = f"https://stooq.pl/q/d/l/?s={stooq_ticker}&i=d"
    try:
        resp = requests.get(url, timeout=8, headers={"User-Agent": "Mozilla/5.0"})
        resp.raise_for_status()
        lines = [l for l in resp.text.strip().split("\n") if l and "B/D" not in l and "Data" not in l]
        if not lines:
            return None
        parts = lines[-1].split(",")
        if len(parts) < 5 or parts[4] in ("N/D", "", "null"):
            return None
        close = float(parts[4])
        open_ = float(parts[1]) if len(parts) > 1 and parts[1] not in ("N/D", "") else close
        daily_change_pct = ((close - open_) / open_ * 100) if open_ > 0 else 0.0
        return close, daily_change_pct
    except Exception as e:
        logger.warning(f"Stooq fetch failed for {stooq_ticker}: {e}")
        return None


def _fetch_yfinance(ticker: str) -> Optional[Tuple[float, float]]:
    """Pobiera ostatnie zamknięcie z yfinance."""
    try:
        t = yf.Ticker(ticker)
        hist = t.history(period="5d", auto_adjust=True)
        if hist.empty:
            logger.warning(f"yfinance: brak danych dla {ticker}")
            return None
        close = float(hist["Close"].iloc[-1])
        prev_close = float(hist["Close"].iloc[-2]) if len(hist) >= 2 else close
        daily_change_pct = ((close - prev_close) / prev_close * 100) if prev_close > 0 else 0.0
        return close, daily_change_pct
    except Exception as e:
        logger.warning(f"yfinance fetch failed for {ticker}: {e}")
        return None


def get_price(ticker: str, currency: str = "PLN") -> Dict:
    cache_key = ticker.upper()
    if cache_key in _price_cache:
        price, daily_pct, cached_at = _price_cache[cache_key]
        if _is_cache_valid(cached_at):
            fx_rate = get_fx_rate_pln(currency)
            return {
                "ticker": ticker, "price": price, "daily_change_pct": daily_pct,
                "currency": currency, "fx_rate": fx_rate,
                "price_pln": price * fx_rate, "cached": True
            }

    result = None
    ticker_upper = ticker.upper()
    is_gpw = (
        ticker_upper.startswith("WSE:")
        or ticker_upper.endswith(".WA")
        or ticker_upper.endswith(".PL")
    )

    if is_gpw:
        result = _fetch_stooq(ticker)

    if result is None:
        result = _fetch_yfinance(ticker)

    if result is None:
        return {
            "ticker": ticker, "price": None, "daily_change_pct": None,
            "currency": currency, "fx_rate": get_fx_rate_pln(currency),
            "price_pln": None, "error": "Nie udało się pobrać ceny"
        }

    price, daily_pct = result
    _price_cache[cache_key] = (price, daily_pct, datetime.utcnow())
    fx_rate = get_fx_rate_pln(currency)
    return {
        "ticker": ticker, "price": price, "daily_change_pct": daily_pct,
        "currency": currency, "fx_rate": fx_rate,
        "price_pln": price * fx_rate, "cached": False
    }


def get_prices_batch(tickers_with_currency: list) -> Dict:
    results = {}
    for ticker, currency in tickers_with_currency:
        results[ticker] = get_price(ticker, currency)
    return results
