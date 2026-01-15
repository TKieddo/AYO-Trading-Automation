"""Client for technical analysis using TA-Lib (via pandas-ta) and Binance for market data."""

import pandas as pd
import pandas_ta as ta
import requests
import logging
import time
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone


class TechnicalAnalysisClient:
    """Fetches market data from Binance and calculates indicators using pandas-ta (TA-Lib compatible)."""

    def __init__(self):
        """Initialize Binance client (no API key needed for public market data)."""
        self.binance_base_url = "https://api.binance.com/api/v3"
        self.logger = logging.getLogger(__name__)

    def _get_with_retry(self, url: str, params: dict, retries: int = 3, backoff: float = 0.5):
        """Perform a GET request with exponential backoff retry logic."""
        for attempt in range(retries):
            try:
                resp = requests.get(url, params=params, timeout=10)
                resp.raise_for_status()
                return resp.json()
            except requests.HTTPError as e:
                if e.response.status_code >= 500 and attempt < retries - 1:
                    wait = backoff * (2 ** attempt)
                    self.logger.warning(f"Binance {e.response.status_code}, retrying in {wait}s")
                    time.sleep(wait)
                else:
                    raise
            except requests.Timeout as e:
                if attempt < retries - 1:
                    wait = backoff * (2 ** attempt)
                    self.logger.warning(f"Binance timeout, retrying in {wait}s")
                    time.sleep(wait)
                else:
                    raise
        raise RuntimeError("Max retries exceeded")

    def _interval_to_binance(self, interval: str) -> str:
        """Convert interval strings to Binance format."""
        mapping = {
            "1m": "1m", "3m": "3m", "5m": "5m", "15m": "15m", "30m": "30m",
            "1h": "1h", "2h": "2h", "4h": "4h", "6h": "6h", "8h": "8h", "12h": "12h",
            "1d": "1d", "3d": "3d", "1w": "1w", "1M": "1M"
        }
        return mapping.get(interval.lower(), interval)

    def _get_klines(self, symbol: str, interval: str, limit: int = 500) -> pd.DataFrame:
        """Fetch candlestick (Kline) data from Binance and convert to DataFrame."""
        try:
            # Convert symbol format (BTC/USDT -> BTCUSDT)
            binance_symbol = symbol.replace("/", "").upper()
            binance_interval = self._interval_to_binance(interval)
            
            url = f"{self.binance_base_url}/klines"
            params = {
                "symbol": binance_symbol,
                "interval": binance_interval,
                "limit": min(limit, 1000)  # Binance max is 1000
            }
            
            data = self._get_with_retry(url, params)
            
            # Convert to DataFrame
            df = pd.DataFrame(data, columns=[
                "timestamp", "open", "high", "low", "close", "volume",
                "close_time", "quote_volume", "trades", "taker_buy_base",
                "taker_buy_quote", "ignore"
            ])
            
            # Convert to numeric and proper types
            df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms", utc=True)
            for col in ["open", "high", "low", "close", "volume"]:
                df[col] = pd.to_numeric(df[col], errors="coerce")
            
            df = df[["timestamp", "open", "high", "low", "close", "volume"]].copy()
            df.set_index("timestamp", inplace=True)
            
            return df
        except Exception as e:
            self.logger.error(f"Error fetching klines for {symbol} {interval}: {e}")
            return pd.DataFrame()

    def _calculate_ema(self, df: pd.DataFrame, period: int) -> pd.Series:
        """Calculate Exponential Moving Average."""
        if len(df) < period:
            return pd.Series(dtype=float)
        return ta.ema(df["close"], length=period)

    def _calculate_sma(self, df: pd.DataFrame, period: int) -> pd.Series:
        """Calculate Simple Moving Average."""
        if len(df) < period:
            return pd.Series(dtype=float)
        return ta.sma(df["close"], length=period)

    def _calculate_rsi(self, df: pd.DataFrame, period: int = 14) -> pd.Series:
        """Calculate Relative Strength Index."""
        if len(df) < period + 1:
            return pd.Series(dtype=float)
        return ta.rsi(df["close"], length=period)

    def _calculate_macd(self, df: pd.DataFrame, fast: int = 12, slow: int = 26, signal: int = 9) -> Dict[str, pd.Series]:
        """Calculate MACD (Moving Average Convergence Divergence)."""
        if len(df) < slow:
            return {"MACD": pd.Series(dtype=float), "MACD_signal": pd.Series(dtype=float), "MACD_hist": pd.Series(dtype=float)}
        macd = ta.macd(df["close"], fast=fast, slow=slow, signal=signal)
        if macd is None or len(macd.columns) == 0:
            return {"MACD": pd.Series(dtype=float), "MACD_signal": pd.Series(dtype=float), "MACD_hist": pd.Series(dtype=float)}
        # pandas-ta returns DataFrame with columns like MACD_12_26_9, MACDs_12_26_9, MACDh_12_26_9
        cols = macd.columns.tolist()
        return {
            "MACD": macd[cols[0]] if len(cols) > 0 else pd.Series(dtype=float),
            "MACD_signal": macd[cols[1]] if len(cols) > 1 else pd.Series(dtype=float),
            "MACD_hist": macd[cols[2]] if len(cols) > 2 else pd.Series(dtype=float)
        }

    def _calculate_atr(self, df: pd.DataFrame, period: int = 14) -> pd.Series:
        """Calculate Average True Range."""
        if len(df) < period:
            return pd.Series(dtype=float)
        return ta.atr(df["high"], df["low"], df["close"], length=period)

    def _calculate_bbands(self, df: pd.DataFrame, period: int = 20, std: float = 2.0) -> Dict[str, pd.Series]:
        """Calculate Bollinger Bands."""
        if len(df) < period:
            return {"upper": pd.Series(dtype=float), "middle": pd.Series(dtype=float), "lower": pd.Series(dtype=float)}
        bbands = ta.bbands(df["close"], length=period, std=std)
        if bbands is None or len(bbands.columns) == 0:
            return {"upper": pd.Series(dtype=float), "middle": pd.Series(dtype=float), "lower": pd.Series(dtype=float)}
        cols = bbands.columns.tolist()
        return {
            "upper": bbands[cols[0]] if len(cols) > 0 else pd.Series(dtype=float),
            "middle": bbands[cols[1]] if len(cols) > 1 else pd.Series(dtype=float),
            "lower": bbands[cols[2]] if len(cols) > 2 else pd.Series(dtype=float)
        }

    def fetch_series(self, indicator: str, symbol: str, interval: str, results: int = 10, 
                     params: Optional[dict] = None, value_key: str = "value") -> List[float]:
        """Fetch and return a historical indicator series.

        Args:
            indicator: Indicator name (ema, sma, rsi, macd, atr, bbands).
            symbol: Market pair (e.g., "BTC/USDT").
            interval: Candle interval (e.g., "5m", "1h", "4h").
            results: Number of datapoints to return.
            params: Additional parameters (e.g., {"period": 20}).
            value_key: For MACD, which value to return (valueMACD, valueMACDSignal, valueMACDHist).

        Returns:
            List of floats (latest values first), rounded to 4 decimals.
        """
        try:
            df = self._get_klines(symbol, interval, limit=max(results * 2, 100))
            if df.empty or len(df) < 2:
                self.logger.warning(f"Insufficient data for {symbol} {interval}")
                return []

            period = (params or {}).get("period", 14) if params else 14
            indicator_lower = indicator.lower()

            if indicator_lower == "ema":
                series = self._calculate_ema(df, period)
            elif indicator_lower == "sma":
                series = self._calculate_sma(df, period)
            elif indicator_lower == "rsi":
                series = self._calculate_rsi(df, period)
            elif indicator_lower == "atr":
                series = self._calculate_atr(df, period)
            elif indicator_lower == "macd":
                macd_data = self._calculate_macd(df, 
                    fast=params.get("fast", 12) if params else 12,
                    slow=params.get("slow", 26) if params else 26,
                    signal=params.get("signal", 9) if params else 9
                )
                # Return appropriate MACD series based on value_key
                if value_key == "valueMACD":
                    series = macd_data.get("MACD", pd.Series(dtype=float))
                elif value_key == "valueMACDSignal":
                    series = macd_data.get("MACD_signal", pd.Series(dtype=float))
                elif value_key == "valueMACDHist":
                    series = macd_data.get("MACD_hist", pd.Series(dtype=float))
                else:
                    series = macd_data.get("MACD", pd.Series(dtype=float))
            elif indicator_lower == "bbands":
                bbands_data = self._calculate_bbands(df, period, std=params.get("std", 2.0) if params else 2.0)
                # For bbands, return middle band by default
                if value_key == "upper":
                    series = bbands_data.get("upper", pd.Series(dtype=float))
                elif value_key == "lower":
                    series = bbands_data.get("lower", pd.Series(dtype=float))
                else:
                    series = bbands_data.get("middle", pd.Series(dtype=float))
            else:
                self.logger.warning(f"Unsupported indicator: {indicator}")
                return []

            if series.empty:
                return []

            # Get last N values, reverse so latest is first
            values = series.dropna().tail(results).tolist()
            values.reverse()
            
            return [round(v, 4) if isinstance(v, (int, float)) else v for v in values]
        except Exception as e:
            self.logger.error(f"Error calculating {indicator} for {symbol}: {e}")
            return []

    def fetch_value(self, indicator: str, symbol: str, interval: str, 
                   params: Optional[dict] = None, key: str = "value") -> Optional[float]:
        """Fetch a single indicator value for the latest candle.

        Args:
            indicator: Indicator name.
            symbol: Market pair.
            interval: Candle interval.
            params: Additional parameters.
            key: Which value to return (for MACD: "value", "valueMACD", "valueMACDSignal", etc.).

        Returns:
            Single float value or None on error.
        """
        try:
            series = self.fetch_series(indicator, symbol, interval, results=1, params=params, value_key=key)
            if series and len(series) > 0:
                return round(series[0], 4) if isinstance(series[0], (int, float)) else series[0]
            return None
        except Exception as e:
            self.logger.error(f"Error fetching {indicator} value for {symbol}: {e}")
            return None

    def get_historical_indicator(self, indicator: str, symbol: str, interval: str, 
                                 results: int = 10, params: Optional[dict] = None) -> List[Dict[str, Any]]:
        """Get historical indicator data in TAAPI-compatible format.

        Returns:
            List of dicts with 'value' key for simple indicators, or dict with multiple keys for complex indicators.
        """
        try:
            df = self._get_klines(symbol, interval, limit=max(results * 2, 100))
            if df.empty:
                return []

            period = (params or {}).get("period", 14) if params else 14
            indicator_lower = indicator.lower()

            if indicator_lower == "ema":
                series = self._calculate_ema(df, period)
            elif indicator_lower == "sma":
                series = self._calculate_sma(df, period)
            elif indicator_lower == "rsi":
                series = self._calculate_rsi(df, period)
            elif indicator_lower == "atr":
                series = self._calculate_atr(df, period)
            elif indicator_lower == "macd":
                macd_data = self._calculate_macd(df,
                    fast=params.get("fast", 12) if params else 12,
                    slow=params.get("slow", 26) if params else 26,
                    signal=params.get("signal", 9) if params else 9
                )
                # Return MACD in TAAPI format
                macd_series = macd_data.get("MACD", pd.Series(dtype=float))
                signal_series = macd_data.get("MACD_signal", pd.Series(dtype=float))
                hist_series = macd_data.get("MACD_hist", pd.Series(dtype=float))
                
                result = []
                for i in range(min(results, len(df))):
                    idx = len(df) - results + i if len(df) >= results else i
                    result.append({
                        "valueMACD": round(macd_series.iloc[idx], 4) if idx < len(macd_series) and not pd.isna(macd_series.iloc[idx]) else None,
                        "valueMACDSignal": round(signal_series.iloc[idx], 4) if idx < len(signal_series) and not pd.isna(signal_series.iloc[idx]) else None,
                        "valueMACDHist": round(hist_series.iloc[idx], 4) if idx < len(hist_series) and not pd.isna(hist_series.iloc[idx]) else None
                    })
                return result
            elif indicator_lower == "bbands":
                bbands_data = self._calculate_bbands(df, period, std=params.get("std", 2.0) if params else 2.0)
                upper = bbands_data.get("upper", pd.Series(dtype=float))
                middle = bbands_data.get("middle", pd.Series(dtype=float))
                lower = bbands_data.get("lower", pd.Series(dtype=float))
                
                result = []
                for i in range(min(results, len(df))):
                    idx = len(df) - results + i if len(df) >= results else i
                    result.append({
                        "upper": round(upper.iloc[idx], 4) if idx < len(upper) and not pd.isna(upper.iloc[idx]) else None,
                        "middle": round(middle.iloc[idx], 4) if idx < len(middle) and not pd.isna(middle.iloc[idx]) else None,
                        "lower": round(lower.iloc[idx], 4) if idx < len(lower) and not pd.isna(lower.iloc[idx]) else None
                    })
                return result
            else:
                self.logger.warning(f"Unsupported indicator for get_historical_indicator: {indicator}")
                return []

            if series.empty:
                return []

            # Convert to TAAPI-compatible format
            values = series.dropna().tail(results).tolist()
            result = [{"value": round(v, 4) if isinstance(v, (int, float)) else v} for v in reversed(values)]
            return result
        except Exception as e:
            self.logger.error(f"Error in get_historical_indicator for {indicator}: {e}")
            return []

    def get_indicators(self, asset: str, interval: str) -> Dict[str, Any]:
        """Return a curated bundle of indicators for an asset (TAAPI-compatible format)."""
        try:
            symbol = f"{asset}/USDT"
            df = self._get_klines(symbol, interval, limit=100)
            
            if df.empty:
                return {
                    "rsi": None,
                    "macd": {"valueMACD": None, "valueMACDSignal": None, "valueMACDHist": None},
                    "sma": None,
                    "ema": None,
                    "bbands": {"upper": None, "middle": None, "lower": None}
                }

            rsi = self._calculate_rsi(df, period=14)
            macd_data = self._calculate_macd(df)
            sma = self._calculate_sma(df, period=20)
            ema = self._calculate_ema(df, period=20)
            bbands_data = self._calculate_bbands(df, period=20)

            return {
                "rsi": round(rsi.iloc[-1], 4) if not rsi.empty and not pd.isna(rsi.iloc[-1]) else None,
                "macd": {
                    "valueMACD": round(macd_data["MACD"].iloc[-1], 4) if not macd_data["MACD"].empty and not pd.isna(macd_data["MACD"].iloc[-1]) else None,
                    "valueMACDSignal": round(macd_data["MACD_signal"].iloc[-1], 4) if not macd_data["MACD_signal"].empty and not pd.isna(macd_data["MACD_signal"].iloc[-1]) else None,
                    "valueMACDHist": round(macd_data["MACD_hist"].iloc[-1], 4) if not macd_data["MACD_hist"].empty and not pd.isna(macd_data["MACD_hist"].iloc[-1]) else None
                },
                "sma": round(sma.iloc[-1], 4) if not sma.empty and not pd.isna(sma.iloc[-1]) else None,
                "ema": round(ema.iloc[-1], 4) if not ema.empty and not pd.isna(ema.iloc[-1]) else None,
                "bbands": {
                    "upper": round(bbands_data["upper"].iloc[-1], 4) if not bbands_data["upper"].empty and not pd.isna(bbands_data["upper"].iloc[-1]) else None,
                    "middle": round(bbands_data["middle"].iloc[-1], 4) if not bbands_data["middle"].empty and not pd.isna(bbands_data["middle"].iloc[-1]) else None,
                    "lower": round(bbands_data["lower"].iloc[-1], 4) if not bbands_data["lower"].empty and not pd.isna(bbands_data["lower"].iloc[-1]) else None
                }
            }
        except Exception as e:
            self.logger.error(f"Error in get_indicators for {asset} {interval}: {e}")
            return {
                "rsi": None,
                "macd": {"valueMACD": None, "valueMACDSignal": None, "valueMACDHist": None},
                "sma": None,
                "ema": None,
                "bbands": {"upper": None, "middle": None, "lower": None}
            }

