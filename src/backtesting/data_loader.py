"""Historical data loader for backtesting."""

import pandas as pd
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import requests


class DataLoader:
    """Load historical OHLCV data for backtesting."""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def load_from_binance(
        self,
        symbol: str,
        interval: str,
        start_date: datetime,
        end_date: datetime
    ) -> Optional[pd.DataFrame]:
        """Load historical data from Binance.
        
        Args:
            symbol: Trading pair (e.g., 'BTCUSDT')
            interval: Timeframe ('1m', '5m', '15m', '1h', '4h', '1d')
            start_date: Start date
            end_date: End date
            
        Returns:
            DataFrame with columns: timestamp, open, high, low, close, volume
        """
        try:
            # Binance API endpoint
            url = "https://api.binance.com/api/v3/klines"
            
            # Convert interval to Binance format
            interval_map = {
                '1m': '1m',
                '5m': '5m',
                '15m': '15m',
                '1h': '1h',
                '4h': '4h',
                '1d': '1d',
            }
            binance_interval = interval_map.get(interval, interval)
            
            # Convert dates to milliseconds
            start_ms = int(start_date.timestamp() * 1000)
            end_ms = int(end_date.timestamp() * 1000)
            
            all_data = []
            current_start = start_ms
            limit = 1000  # Binance max per request
            
            while current_start < end_ms:
                params = {
                    'symbol': symbol.upper(),
                    'interval': binance_interval,
                    'startTime': current_start,
                    'endTime': end_ms,
                    'limit': limit,
                }
                
                response = requests.get(url, params=params, timeout=30)
                response.raise_for_status()
                klines = response.json()
                
                if not klines:
                    break
                
                all_data.extend(klines)
                
                # Update start time for next batch
                current_start = klines[-1][0] + 1
                
                # Avoid rate limiting
                import time
                time.sleep(0.1)
            
            if not all_data:
                self.logger.warning(f"No data found for {symbol} from {start_date} to {end_date}")
                return None
            
            # Convert to DataFrame
            df = pd.DataFrame(all_data, columns=[
                'timestamp', 'open', 'high', 'low', 'close', 'volume',
                'close_time', 'quote_volume', 'trades', 'taker_buy_base',
                'taker_buy_quote', 'ignore'
            ])
            
            # Convert types
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            for col in ['open', 'high', 'low', 'close', 'volume']:
                df[col] = df[col].astype(float)
            
            # Select and rename columns
            df = df[['timestamp', 'open', 'high', 'low', 'close', 'volume']].copy()
            df.set_index('timestamp', inplace=True)
            
            self.logger.info(f"Loaded {len(df)} candles for {symbol} ({interval})")
            return df
            
        except Exception as e:
            self.logger.error(f"Error loading data from Binance: {e}")
            return None
    
    def load_from_database(
        self,
        symbol: str,
        interval: str,
        start_date: datetime,
        end_date: datetime
    ) -> Optional[pd.DataFrame]:
        """Load historical data from database cache.
        
        Args:
            symbol: Trading pair
            interval: Timeframe
            start_date: Start date
            end_date: End date
            
        Returns:
            DataFrame with OHLCV data
        """
        # TODO: Implement database loading
        # This would query the historical_ohlcv table
        return None

