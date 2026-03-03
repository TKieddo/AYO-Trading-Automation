"""
Pair Hunter - Dynamically discovers best trading pairs
Scans market for high-probability setups instead of hardcoded list
"""

import asyncio
import logging
from typing import List, Dict, Tuple
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

# Blacklist - known scam/low-quality coins (expand as needed)
SCAM_BLACKLIST = {
    'SHIB', 'PEPE', 'FLOKI', 'BONK', 'DOGE',  # Meme coins (volatile but risky)
    'LUNA', 'FTT',  # Dead projects
}

# Minimum requirements for consideration
MIN_VOLUME_24H = 10_000_000  # $10M daily volume
MIN_PRICE = 0.01  # Avoid sub-penny coins
MAX_SPREAD_PCT = 0.5  # Max 0.5% bid-ask spread (liquidity check)


class PairHunter:
    """Discovers optimal trading pairs based on volatility and setup quality"""
    
    def __init__(self, exchange_client, top_n: int = 10):
        self.exchange = exchange_client
        self.top_n = top_n  # Return top N pairs
        
    async def hunt_pairs(self, min_volatility: float = 2.0, timeframe: str = '5m') -> List[str]:
        """
        Hunt for best trading pairs
        
        Args:
            min_volatility: Minimum 24h volatility % (2.0 = 2%)
            timeframe: Analysis timeframe
            
        Returns:
            List of asset symbols (e.g., ['BTC', 'ETH', 'SOL'])
        """
        logger.info(f"🔍 PAIR HUNTER: Scanning for top {self.top_n} opportunities...")
        
        # Step 1: Get all futures pairs with volume
        all_pairs = await self._get_futures_pairs()
        logger.info(f"Found {len(all_pairs)} total futures pairs")
        
        # Step 2: Filter by basic criteria
        qualified = await self._filter_basic_criteria(all_pairs)
        logger.info(f"{len(qualified)} pairs passed basic filters")
        
        # Step 3: Calculate volatility and trend strength
        scored = await self._score_pairs(qualified, timeframe)
        
        # Step 4: Sort by score and return top N
        top_pairs = sorted(scored, key=lambda x: x['score'], reverse=True)[:self.top_n]
        
        assets = [p['asset'] for p in top_pairs]
        
        # Log results
        logger.info("🏆 TOP PAIRS DISCOVERED:")
        for i, p in enumerate(top_pairs, 1):
            logger.info(f"  {i}. {p['asset']}: Score {p['score']:.1f} | "
                       f"Vol: {p['volatility']:.1f}% | "
                       f"Trend: {p['trend_strength']:.1f} | "
                       f"Setup: {p['setup_quality']}")
        
        return assets
    
    async def _get_futures_pairs(self) -> List[Dict]:
        """Get all USDT perpetual futures with 24h volume"""
        try:
            exchange_info = await self.exchange.get_exchange_info()
            tickers = await self.exchange.get_24h_tickers()
            
            # Create volume lookup
            volume_map = {t['symbol']: float(t.get('volume', 0)) * float(t.get('weightedAvgPrice', 0)) 
                         for t in tickers}
            
            pairs = []
            for symbol_info in exchange_info.get('symbols', []):
                symbol = symbol_info['symbol']
                
                # Only USDT perpetual futures
                if not symbol.endswith('USDT'):
                    continue
                    
                asset = symbol.replace('USDT', '')
                
                # Skip blacklisted
                if asset in SCAM_BLACKLIST:
                    continue
                
                volume = volume_map.get(symbol, 0)
                
                pairs.append({
                    'asset': asset,
                    'symbol': symbol,
                    'volume_24h': volume,
                    'status': symbol_info.get('status', 'TRADING')
                })
            
            return pairs
            
        except Exception as e:
            logger.error(f"Error getting futures pairs: {e}")
            return []
    
    async def _filter_basic_criteria(self, pairs: List[Dict]) -> List[Dict]:
        """Filter by volume, price, spread"""
        qualified = []
        
        for pair in pairs:
            # Minimum volume
            if pair['volume_24h'] < MIN_VOLUME_24H:
                continue
            
            # Must be trading
            if pair['status'] != 'TRADING':
                continue
            
            # Check price and spread
            try:
                ticker = await self.exchange.get_ticker(pair['symbol'])
                price = float(ticker.get('lastPrice', 0))
                bid = float(ticker.get('bidPrice', price))
                ask = float(ticker.get('askPrice', price))
                
                # Minimum price
                if price < MIN_PRICE:
                    continue
                
                # Spread check (liquidity)
                if bid > 0 and ask > 0:
                    spread_pct = ((ask - bid) / ((ask + bid) / 2)) * 100
                    if spread_pct > MAX_SPREAD_PCT:
                        continue
                
                pair['price'] = price
                pair['spread_pct'] = spread_pct if bid > 0 and ask > 0 else 0
                qualified.append(pair)
                
            except Exception as e:
                logger.debug(f"Error checking {pair['symbol']}: {e}")
                continue
        
        return qualified
    
    async def _score_pairs(self, pairs: List[Dict], timeframe: str) -> List[Dict]:
        """Calculate setup scores for each pair"""
        scored = []
        
        for pair in pairs:
            try:
                asset = pair['asset']
                
                # Get recent price data (last 100 candles)
                candles = await self.exchange.get_klines(
                    symbol=pair['symbol'],
                    interval=timeframe,
                    limit=100
                )
                
                if len(candles) < 50:
                    continue
                
                # Calculate metrics
                volatility = self._calc_volatility(candles)
                trend_strength = self._calc_trend_strength(candles)
                rsi = self._calc_rsi(candles)
                ema_alignment = self._check_ema_alignment(candles)
                
                # Setup quality assessment
                setup_quality = self._assess_setup(rsi, ema_alignment, volatility)
                
                # Composite score (0-100)
                # Higher volatility = more opportunity (up to 30 points)
                # Strong trend = better direction (up to 30 points)
                # Good setup = higher probability (up to 40 points)
                
                vol_score = min(volatility * 5, 30)  # 6% vol = 30 points
                trend_score = min(abs(trend_strength) * 3, 30)  # Strong trend = 30 points
                setup_score = setup_quality  # 0-40 based on RSI/EMA confluence
                
                total_score = vol_score + trend_score + setup_score
                
                scored.append({
                    'asset': asset,
                    'symbol': pair['symbol'],
                    'price': pair['price'],
                    'volume_24h': pair['volume_24h'],
                    'volatility': volatility,
                    'trend_strength': trend_strength,
                    'rsi': rsi,
                    'ema_alignment': ema_alignment,
                    'setup_quality': setup_quality,
                    'score': total_score
                })
                
            except Exception as e:
                logger.debug(f"Error scoring {pair['asset']}: {e}")
                continue
        
        return scored
    
    def _calc_volatility(self, candles: List[List]) -> float:
        """Calculate 24h volatility as %"""
        if len(candles) < 20:
            return 0
        
        # Use last ~24h of 5m candles (288 candles)
        recent = candles[-min(len(candles), 288):]
        
        highs = [float(c[2]) for c in recent]
        lows = [float(c[3]) for c in recent]
        
        if not highs or not lows:
            return 0
        
        max_high = max(highs)
        min_low = min(lows)
        mid = (max_high + min_low) / 2
        
        if mid == 0:
            return 0
        
        volatility = ((max_high - min_low) / mid) * 100
        return volatility
    
    def _calc_trend_strength(self, candles: List[List]) -> float:
        """Calculate trend strength (-100 to +100, positive = uptrend)"""
        if len(candles) < 50:
            return 0
        
        closes = [float(c[4]) for c in candles]
        
        # Simple linear regression slope
        n = min(len(closes), 50)
        y = closes[-n:]
        x = list(range(n))
        
        # Calculate slope
        x_mean = sum(x) / n
        y_mean = sum(y) / n
        
        numerator = sum((x[i] - x_mean) * (y[i] - y_mean) for i in range(n))
        denominator = sum((x[i] - x_mean) ** 2 for i in range(n))
        
        if denominator == 0:
            return 0
        
        slope = numerator / denominator
        
        # Normalize to -100 to +100 based on % change
        start_price = y[0]
        if start_price == 0:
            return 0
        
        pct_change = (slope * n) / start_price * 100
        trend_strength = max(-100, min(100, pct_change * 5))  # Scale and clamp
        
        return trend_strength
    
    def _calc_rsi(self, candles: List[List], period: int = 14) -> float:
        """Calculate RSI (0-100)"""
        if len(candles) < period + 1:
            return 50
        
        closes = [float(c[4]) for c in candles]
        
        gains = []
        losses = []
        
        for i in range(1, period + 1):
            change = closes[-i] - closes[-i-1]
            if change > 0:
                gains.append(change)
            else:
                losses.append(abs(change))
        
        avg_gain = sum(gains) / period if gains else 0
        avg_loss = sum(losses) / period if losses else 0
        
        if avg_loss == 0:
            return 100 if avg_gain > 0 else 50
        
        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        
        return rsi
    
    def _check_ema_alignment(self, candles: List[List]) -> str:
        """Check EMA alignment (bullish/bearish/neutral)"""
        if len(candles) < 50:
            return 'neutral'
        
        closes = [float(c[4]) for c in candles]
        
        # Calculate EMAs
        ema12 = self._calc_ema(closes, 12)
        ema26 = self._calc_ema(closes, 26)
        
        if ema12 is None or ema26 is None:
            return 'neutral'
        
        if ema12 > ema26 * 1.001:  # 0.1% buffer
            return 'bullish'
        elif ema12 < ema26 * 0.999:
            return 'bearish'
        else:
            return 'neutral'
    
    def _calc_ema(self, prices: List[float], period: int) -> float:
        """Calculate EMA for a price series"""
        if len(prices) < period:
            return None
        
        # Start with SMA
        sma = sum(prices[-period:]) / period
        
        # EMA multiplier
        multiplier = 2 / (period + 1)
        
        # Calculate EMA
        ema = sma
        for price in prices[-period:]:
            ema = (price * multiplier) + (ema * (1 - multiplier))
        
        return ema
    
    def _assess_setup(self, rsi: float, ema_alignment: str, volatility: float) -> int:
        """Assess setup quality (0-40 points)"""
        score = 0
        
        # RSI extremes (potential reversal)
        if rsi < 30:  # Oversold
            score += 20
        elif rsi > 70:  # Overbought
            score += 20
        elif rsi < 40 or rsi > 60:  # Near extreme
            score += 10
        
        # EMA alignment (trend confirmation)
        if ema_alignment in ['bullish', 'bearish']:
            score += 10
        
        # Volatility (need movement)
        if 3.0 <= volatility <= 10.0:  # Sweet spot for scalping
            score += 10
        elif volatility > 10.0:  # Too volatile, risky
            score += 5
        elif volatility < 2.0:  # Dead market
            score += 0
        
        return min(score, 40)


# Convenience function for main.py - ASYNC version
async def get_best_pairs(exchange_client, top_n: int = 5, min_volatility: float = 2.0) -> List[str]:
    """Get best trading pairs for current session (async)"""
    hunter = PairHunter(exchange_client, top_n=top_n)
    return await hunter.hunt_pairs(min_volatility=min_volatility)

# Sync version for backward compatibility
def get_best_pairs_sync(exchange_client, top_n: int = 5, min_volatility: float = 2.0) -> List[str]:
    """Get best trading pairs - synchronous wrapper"""
    hunter = PairHunter(exchange_client, top_n=top_n)
    return asyncio.run(hunter.hunt_pairs(min_volatility=min_volatility))
