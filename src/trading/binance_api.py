"""Binance Perpetual Futures trading client with async support."""

import asyncio
import logging
from typing import Optional, Dict, List, Any
from binance.client import Client
from binance.exceptions import BinanceAPIException
from src.config_loader import CONFIG
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class BinanceAPI:
    """Client for Binance Perpetual Futures trading with leverage support."""

    def __init__(self):
        """Initialize Binance Futures client."""
        api_key = CONFIG.get("binance_api_key")
        api_secret = CONFIG.get("binance_api_secret")
        testnet = CONFIG.get("binance_testnet", False)
        
        if not api_key or not api_secret:
            raise ValueError("BINANCE_API_KEY and BINANCE_API_SECRET must be set in .env")
        
        # Initialize Binance Client with retries to tolerate transient 5xx errors from Binance
        # python-binance Client pings in constructor; wrap in retry/backoff
        def _create_client():
            return Client(api_key, api_secret, testnet=testnet)

        max_attempts = 5
        backoff = 1.0
        last_err = None
        for attempt in range(max_attempts):
            try:
                self.client = _create_client()
                break
            except BinanceAPIException as e:
                last_err = e
                # Code 0 often corresponds to invalid HTML/JSON on 5xx like 502/504
                wait_s = backoff * (2 ** attempt)
                # Clean up error message - extract just the key info if it's HTML
                err_msg = getattr(e, 'message', str(e))
                if '<html>' in err_msg or '502' in err_msg or 'Bad Gateway' in err_msg:
                    err_msg = "502 Bad Gateway (Binance server issue)"
                elif len(err_msg) > 200:
                    err_msg = err_msg[:200] + "..."
                logger.warning(f"Binance init failed (attempt {attempt + 1}/{max_attempts}): {err_msg}. Retrying in {wait_s:.1f}s...")
                time.sleep(wait_s)
            except Exception as e:
                last_err = e
                wait_s = backoff * (2 ** attempt)
                err_msg = str(e)
                if len(err_msg) > 200:
                    err_msg = err_msg[:200] + "..."
                logger.warning(f"Binance init error (attempt {attempt + 1}/{max_attempts}): {err_msg}. Retrying in {wait_s:.1f}s...")
                time.sleep(wait_s)
        else:
            # Clean up final error message too
            final_err = str(last_err) if last_err else "Unknown error"
            if '<html>' in final_err or '502' in final_err:
                final_err = "502 Bad Gateway - Binance servers temporarily unavailable"
            elif len(final_err) > 200:
                final_err = final_err[:200] + "..."
            raise RuntimeError(f"Failed to initialize Binance Client after {max_attempts} attempts: {final_err}")
        self.testnet = testnet
        
        # Sync local timestamp offset with Binance server to avoid -1021 timestamp errors
        try:
            server_time = self.client.get_server_time()  # returns {'serverTime': <ms>}
            if isinstance(server_time, dict) and 'serverTime' in server_time:
                local_ms = int(time.time() * 1000)
                offset_ms = int(server_time['serverTime']) - local_ms
                # python-binance respects timestamp_offset when generating signatures
                setattr(self.client, 'timestamp_offset', offset_ms)
                logger.info(f"Synchronized timestamp offset with Binance: {offset_ms}ms")
        except Exception as e:
            logger.warning(f"Could not sync timestamp with Binance server time: {e}")

        # Set recvWindow on client to handle timestamp synchronization
        # recvWindow is the time window (in milliseconds) for the request to be valid
        # Default is 5000ms (5 seconds). Setting to 60000ms (60 seconds) gives more buffer
        # This helps when system time is slightly off from Binance server time
        if hasattr(self.client, 'recvWindow'):
            self.client.recvWindow = 60000
        
        # Default leverage (can be configured per asset)
        self.default_leverage = int(CONFIG.get("binance_leverage", 10))
        
        logger.info(f"Binance Futures client initialized (testnet={testnet}, leverage={self.default_leverage}x, recvWindow=60000ms)")

    def _to_futures_symbol(self, asset: str) -> str:
        """Convert asset name (BTC) to Binance Futures symbol (BTCUSDT)."""
        return f"{asset}USDT"

    def _from_futures_symbol(self, symbol: str) -> str:
        """Convert Binance Futures symbol (BTCUSDT) to asset name (BTC)."""
        return symbol.replace("USDT", "")

    async def _retry(self, fn, *args, max_attempts: int = 3, backoff: float = 0.5, **kwargs):
        """Retry helper with exponential backoff."""
        last_err = None
        for attempt in range(max_attempts):
            try:
                return await asyncio.to_thread(fn, *args, **kwargs)
            except BinanceAPIException as e:
                if e.code == -1021:  # Timestamp error
                    # Binance requires accurate timestamps, retry once
                    if attempt == 0:
                        await asyncio.sleep(0.1)
                        continue
                if e.code in [-1003, -1022, -1021] and attempt < max_attempts - 1:
                    wait = backoff * (2 ** attempt)
                    logger.warning(f"Binance API error {e.code}, retrying in {wait}s: {e.message}")
                    await asyncio.sleep(wait)
                    continue
                raise
            except Exception as e:
                last_err = e
                if attempt < max_attempts - 1:
                    wait = backoff * (2 ** attempt)
                    logger.warning(f"Error in Binance call, retrying in {wait}s: {e}")
                    await asyncio.sleep(wait)
                else:
                    raise
        raise last_err if last_err else RuntimeError("Max retries exceeded")

    async def set_leverage(self, asset: str, leverage: int):
        """Set leverage for a specific asset."""
        symbol = self._to_futures_symbol(asset)
        try:
            await self._retry(
                lambda: self.client.futures_change_leverage(symbol=symbol, leverage=leverage)
            )
            logger.info(f"Set leverage for {asset} to {leverage}x")
        except Exception as e:
            logger.error(f"Failed to set leverage for {asset}: {e}")

    async def place_buy_order(self, asset: str, amount: float, leverage: Optional[int] = None, slippage: float = 0.01):
        """Place a market buy order for perpetual futures.
        
        Args:
            asset: Asset symbol (e.g., 'BTC')
            amount: Contract quantity (number of contracts)
            leverage: Leverage to use (defaults to configured leverage)
            slippage: Unused (kept for compatibility with Hyperliquid interface)
        """
        symbol = self._to_futures_symbol(asset)
        lev = leverage or self.default_leverage
        
        # Set leverage first
        await self.set_leverage(asset, lev)
        
        # Get current price for logging
        ticker = await self._retry(lambda: self.client.futures_symbol_ticker(symbol=symbol))
        current_price = float(ticker['price'])
        
        # Amount is already quantity (contract size), not notional
        quantity = amount
        
        # Get symbol info for precision
        exchange_info = await self._retry(lambda: self.client.futures_exchange_info())
        symbol_info = next((s for s in exchange_info['symbols'] if s['symbol'] == symbol), None)
        
        if symbol_info:
            # Round quantity to step size
            step_size = float([f['stepSize'] for f in symbol_info['filters'] if f['filterType'] == 'LOT_SIZE'][0])
            quantity = round(quantity / step_size) * step_size
            quantity = float(f"{quantity:.{len(str(step_size).split('.')[-1])}f}")
        
        try:
            # Place market order (BUY = LONG position)
            order = await self._retry(
                lambda: self.client.futures_create_order(
                    symbol=symbol,
                    side='BUY',
                    type='MARKET',
                    quantity=quantity
                )
            )
            logger.info(f"Placed BUY order for {asset}: {quantity} @ ~${current_price:.2f}")
            return order
        except BinanceAPIException as e:
            logger.error(f"Failed to place BUY order for {asset}: {e.message} (code: {e.code})")
            raise

    async def place_sell_order(self, asset: str, amount: float, leverage: Optional[int] = None, slippage: float = 0.01):
        """Place a market sell order for perpetual futures (opens SHORT).
        
        Args:
            asset: Asset symbol (e.g., 'BTC')
            amount: Contract quantity (number of contracts)
            leverage: Leverage to use (defaults to configured leverage)
            slippage: Unused (kept for compatibility with Hyperliquid interface)
        """
        symbol = self._to_futures_symbol(asset)
        lev = leverage or self.default_leverage
        
        # Set leverage first
        await self.set_leverage(asset, lev)
        
        # Get current price for logging
        ticker = await self._retry(lambda: self.client.futures_symbol_ticker(symbol=symbol))
        current_price = float(ticker['price'])
        
        # Amount is already quantity (contract size), not notional
        quantity = amount
        
        # Get symbol info for precision
        exchange_info = await self._retry(lambda: self.client.futures_exchange_info())
        symbol_info = next((s for s in exchange_info['symbols'] if s['symbol'] == symbol), None)
        
        if symbol_info:
            # Round quantity to step size
            step_size = float([f['stepSize'] for f in symbol_info['filters'] if f['filterType'] == 'LOT_SIZE'][0])
            quantity = round(quantity / step_size) * step_size
            quantity = float(f"{quantity:.{len(str(step_size).split('.')[-1])}f}")
        
        try:
            # Place market order (SELL = SHORT position)
            order = await self._retry(
                lambda: self.client.futures_create_order(
                    symbol=symbol,
                    side='SELL',
                    type='MARKET',
                    quantity=quantity
                )
            )
            logger.info(f"Placed SELL order for {asset}: {quantity} @ ~${current_price:.2f}")
            return order
        except BinanceAPIException as e:
            logger.error(f"Failed to place SELL order for {asset}: {e.message} (code: {e.code})")
            raise

    async def place_take_profit(self, asset: str, is_long: bool, quantity: float, tp_price: float):
        """Place a take-profit order (closes position at target price).
        
        Args:
            asset: Asset symbol
            is_long: True if closing a long position
            quantity: Position size to close (will be validated against actual position)
            tp_price: Take-profit price
        """
        symbol = self._to_futures_symbol(asset)
        
        # Get current position size to ensure we're closing the right amount
        try:
            positions = await self._retry(lambda: self.client.futures_position_information(symbol=symbol))
            actual_position = None
            for pos in positions:
                if pos.get('symbol') == symbol:
                    pos_amt = float(pos.get('positionAmt', 0))
                    if abs(pos_amt) > 0:  # Has position
                        actual_position = abs(pos_amt)
                        break
        except Exception:
            actual_position = None
        
        # Use actual position size if available, otherwise use provided quantity
        if actual_position:
            quantity = actual_position
            logger.info(f"Using actual position size {quantity} for TP order")
        
        # Get symbol info for precision
        exchange_info = await self._retry(lambda: self.client.futures_exchange_info())
        symbol_info = next((s for s in exchange_info['symbols'] if s['symbol'] == symbol), None)
        
        if symbol_info:
            # Round price to tick size
            tick_size = float([f['tickSize'] for f in symbol_info['filters'] if f['filterType'] == 'PRICE_FILTER'][0])
            tp_price = round(tp_price / tick_size) * tick_size
            tp_price = float(f"{tp_price:.{len(str(tick_size).split('.')[-1])}f}")
            
            # Round quantity
            step_size = float([f['stepSize'] for f in symbol_info['filters'] if f['filterType'] == 'LOT_SIZE'][0])
            quantity = round(quantity / step_size) * step_size
            quantity = float(f"{quantity:.{len(str(step_size).split('.')[-1])}f}")
        
        # Validate TP price is correct direction
        current_price = None
        try:
            ticker = await self._retry(lambda: self.client.futures_symbol_ticker(symbol=symbol))
            current_price = float(ticker['price'])
            
            # For LONG position: TP should be ABOVE current price
            # For SHORT position: TP should be BELOW current price
            if is_long and tp_price <= current_price:
                logger.warning(f"TP price {tp_price} is not above current price {current_price} for long position. Adjusting...")
                tp_price = current_price * 1.01  # Set TP 1% above current as minimum
                tp_price = round(tp_price / tick_size) * tick_size
                tp_price = float(f"{tp_price:.{len(str(tick_size).split('.')[-1])}f}")
            elif not is_long and tp_price >= current_price:
                logger.warning(f"TP price {tp_price} is not below current price {current_price} for short position. Adjusting...")
                tp_price = current_price * 0.99  # Set TP 1% below current as minimum
                tp_price = round(tp_price / tick_size) * tick_size
                tp_price = float(f"{tp_price:.{len(str(tick_size).split('.')[-1])}f}")
        except Exception as e:
            logger.warning(f"Could not validate TP price against current price: {e}")
        
        try:
            # Close position: if long, sell to close; if short, buy to close
            side = 'SELL' if is_long else 'BUY'
            
            # Use closePosition=true instead of quantity for more reliable execution
            # But only if we have an actual position
            order_params = {
                'symbol': symbol,
                'side': side,
                'type': 'TAKE_PROFIT_MARKET',
                'stopPrice': tp_price,
                'reduceOnly': True,
                'workingType': 'CONTRACT_PRICE'  # Use contract price for trigger
            }
            
            # Use quantity if specified and valid, otherwise let Binance determine
            if quantity and quantity > 0:
                order_params['quantity'] = quantity
            
            order = await self._retry(
                lambda: self.client.futures_create_order(**order_params)
            )
            price_info = f" (current: ${current_price:.2f})" if current_price else ""
            logger.info(f"Placed TP order for {asset}: {quantity} @ ${tp_price:.2f}{price_info}")
            return order
        except BinanceAPIException as e:
            logger.error(f"Failed to place TP order for {asset}: {e.message} (code: {e.code})")
            # If quantity error, try with closePosition
            if e.code in [-2021, -4006]:  # Order would immediately trigger or insufficient position
                logger.info(f"Retrying TP with closePosition for {asset}")
                try:
                    order = await self._retry(
                        lambda: self.client.futures_create_order(
                            symbol=symbol,
                            side=side,
                            type='TAKE_PROFIT_MARKET',
                            stopPrice=tp_price,
                            closePosition='true',  # Close entire position
                            workingType='CONTRACT_PRICE'
                        )
                    )
                    logger.info(f"Placed TP order with closePosition for {asset} @ ${tp_price:.2f}")
                    return order
                except Exception as e2:
                    logger.error(f"Failed to place TP with closePosition: {e2}")
            raise

    async def place_stop_loss(self, asset: str, is_long: bool, quantity: float, sl_price: float):
        """Place a stop-loss order (closes position at stop price).
        
        Args:
            asset: Asset symbol
            is_long: True if closing a long position
            quantity: Position size to close (will be validated against actual position)
            sl_price: Stop-loss price
        """
        symbol = self._to_futures_symbol(asset)
        
        # Get current position size to ensure we're closing the right amount
        try:
            positions = await self._retry(lambda: self.client.futures_position_information(symbol=symbol))
            actual_position = None
            for pos in positions:
                if pos.get('symbol') == symbol:
                    pos_amt = float(pos.get('positionAmt', 0))
                    if abs(pos_amt) > 0:  # Has position
                        actual_position = abs(pos_amt)
                        break
        except Exception:
            actual_position = None
        
        # Use actual position size if available, otherwise use provided quantity
        if actual_position:
            quantity = actual_position
            logger.info(f"Using actual position size {quantity} for SL order")
        
        # Get symbol info for precision
        exchange_info = await self._retry(lambda: self.client.futures_exchange_info())
        symbol_info = next((s for s in exchange_info['symbols'] if s['symbol'] == symbol), None)
        
        if symbol_info:
            # Round price to tick size
            tick_size = float([f['tickSize'] for f in symbol_info['filters'] if f['filterType'] == 'PRICE_FILTER'][0])
            sl_price = round(sl_price / tick_size) * tick_size
            sl_price = float(f"{sl_price:.{len(str(tick_size).split('.')[-1])}f}")
            
            # Round quantity
            step_size = float([f['stepSize'] for f in symbol_info['filters'] if f['filterType'] == 'LOT_SIZE'][0])
            quantity = round(quantity / step_size) * step_size
            quantity = float(f"{quantity:.{len(str(step_size).split('.')[-1])}f}")
        
        # Validate SL price is correct direction
        current_price = None
        try:
            ticker = await self._retry(lambda: self.client.futures_symbol_ticker(symbol=symbol))
            current_price = float(ticker['price'])
            
            # For LONG position: SL should be BELOW current price
            # For SHORT position: SL should be ABOVE current price
            if is_long and sl_price >= current_price:
                logger.warning(f"SL price {sl_price} is not below current price {current_price} for long position. Adjusting...")
                sl_price = current_price * 0.99  # Set SL 1% below current as minimum
                sl_price = round(sl_price / tick_size) * tick_size
                sl_price = float(f"{sl_price:.{len(str(tick_size).split('.')[-1])}f}")
            elif not is_long and sl_price <= current_price:
                logger.warning(f"SL price {sl_price} is not above current price {current_price} for short position. Adjusting...")
                sl_price = current_price * 1.01  # Set SL 1% above current as minimum
                sl_price = round(sl_price / tick_size) * tick_size
                sl_price = float(f"{sl_price:.{len(str(tick_size).split('.')[-1])}f}")
        except Exception as e:
            logger.warning(f"Could not validate SL price against current price: {e}")
        
        try:
            # Close position: if long, sell to close; if short, buy to close
            side = 'SELL' if is_long else 'BUY'
            
            # Use closePosition=true for more reliable execution
            order_params = {
                'symbol': symbol,
                'side': side,
                'type': 'STOP_MARKET',
                'stopPrice': sl_price,
                'reduceOnly': True,
                'workingType': 'CONTRACT_PRICE'  # Use contract price for trigger
            }
            
            # Use quantity if specified and valid
            if quantity and quantity > 0:
                order_params['quantity'] = quantity
            
            order = await self._retry(
                lambda: self.client.futures_create_order(**order_params)
            )
            price_info = f" (current: ${current_price:.2f})" if current_price else ""
            logger.info(f"Placed SL order for {asset}: {quantity} @ ${sl_price:.2f}{price_info}")
            return order
        except BinanceAPIException as e:
            logger.error(f"Failed to place SL order for {asset}: {e.message} (code: {e.code})")
            # If quantity error, try with closePosition
            if e.code in [-2021, -4006]:  # Order would immediately trigger or insufficient position
                logger.info(f"Retrying SL with closePosition for {asset}")
                try:
                    order = await self._retry(
                        lambda: self.client.futures_create_order(
                            symbol=symbol,
                            side=side,
                            type='STOP_MARKET',
                            stopPrice=sl_price,
                            closePosition='true',  # Close entire position
                            workingType='CONTRACT_PRICE'
                        )
                    )
                    logger.info(f"Placed SL order with closePosition for {asset} @ ${sl_price:.2f}")
                    return order
                except Exception as e2:
                    logger.error(f"Failed to place SL with closePosition: {e2}")
            raise

    def extract_oids(self, order_result: Dict) -> List[str]:
        """Extract order IDs from Binance order response."""
        if isinstance(order_result, dict) and 'orderId' in order_result:
            return [str(order_result['orderId'])]
        return []

    async def get_user_state(self) -> Dict[str, Any]:
        """Get account balance and positions."""
        try:
            account = await self._retry(lambda: self.client.futures_account())
            positions = await self._retry(lambda: self.client.futures_position_information())
            
            # Extract relevant data
            balance = float(account.get('totalWalletBalance', 0))
            total_value = float(account.get('totalMarginBalance', 0))
            
            # Format positions
            enriched_positions = []
            for pos in positions:
                position_amt = float(pos.get('positionAmt', 0))
                if abs(position_amt) > 0:  # Only include open positions
                    entry_price = float(pos.get('entryPrice', 0))
                    current_price = float(pos.get('markPrice', 0))
                    unrealized_pnl = float(pos.get('unRealizedProfit', 0))
                    liquidation_price = float(pos.get('liquidationPrice', 0)) if pos.get('liquidationPrice') else None
                    
                    asset = self._from_futures_symbol(pos.get('symbol', ''))
                    enriched_positions.append({
                        'coin': asset,
                        'symbol': asset,  # Add both for compatibility
                        'szi': position_amt,  # Positive = long, negative = short
                        'quantity': abs(position_amt),  # Absolute size
                        'positionAmt': position_amt,  # Original signed value
                        'entryPx': entry_price,
                        'entryPrice': entry_price,  # Add both formats
                        'pnl': unrealized_pnl,
                        'unrealized_pnl': unrealized_pnl,  # Add both formats
                        'current_price': current_price,
                        'markPrice': current_price,  # Add both formats
                        'liquidation_price': liquidation_price,
                        'liquidationPrice': liquidation_price,  # Add both formats
                        'liquidationPx': liquidation_price  # Hyperliquid format
                    })
            
            return {
                'balance': balance,
                'total_value': total_value,
                'positions': enriched_positions
            }
        except Exception as e:
            logger.error(f"Error getting user state: {e}")
            return {'balance': 0, 'total_value': 0, 'positions': []}

    async def get_current_price(self, asset: str) -> float:
        """Get current mark price for an asset."""
        symbol = self._to_futures_symbol(asset)
        try:
            ticker = await self._retry(lambda: self.client.futures_symbol_ticker(symbol=symbol))
            return float(ticker['price'])
        except Exception as e:
            logger.error(f"Error getting price for {asset}: {e}")
            return 0.0

    async def get_open_orders(self) -> List[Dict]:
        """Get all open orders."""
        try:
            orders = await self._retry(lambda: self.client.futures_get_open_orders())
            formatted_orders = []
            for o in orders:
                asset = self._from_futures_symbol(o.get('symbol', ''))
                formatted_orders.append({
                    'coin': asset,
                    'oid': str(o.get('orderId', '')),
                    'isBuy': o.get('side') == 'BUY',
                    'sz': float(o.get('origQty', 0)),
                    'px': float(o.get('price', 0)),
                    'triggerPx': float(o.get('stopPrice', 0)),
                    'orderType': o.get('type', '')
                })
            return formatted_orders
        except Exception as e:
            logger.error(f"Error getting open orders: {e}")
            return []

    async def get_recent_fills(self, limit: int = 50) -> List[Dict]:
        """Get recent trade history."""
        try:
            trades = await self._retry(lambda: self.client.futures_account_trades())
            formatted_trades = []
            for t in trades[-limit:]:
                asset = self._from_futures_symbol(t.get('symbol', ''))
                formatted_trades.append({
                    'coin': asset,
                    'asset': asset,
                    'isBuy': t.get('side') == 'BUY',
                    'sz': float(t.get('qty', 0)),
                    'size': float(t.get('qty', 0)),
                    'px': float(t.get('price', 0)),
                    'price': float(t.get('price', 0)),
                    'time': t.get('time', 0),
                    'timestamp': t.get('time', 0)
                })
            return formatted_trades
        except Exception as e:
            logger.error(f"Error getting recent fills: {e}")
            return []

    async def get_open_interest(self, asset: str) -> Optional[float]:
        """Get open interest for an asset."""
        symbol = self._to_futures_symbol(asset)
        try:
            oi_data = await self._retry(lambda: self.client.futures_open_interest(symbol=symbol))
            return float(oi_data.get('openInterest', 0))
        except Exception as e:
            logger.error(f"Error getting open interest for {asset}: {e}")
            return None

    async def get_funding_rate(self, asset: str) -> Optional[float]:
        """Get current funding rate for an asset."""
        symbol = self._to_futures_symbol(asset)
        try:
            funding = await self._retry(lambda: self.client.futures_funding_rate(symbol=symbol, limit=1))
            if funding and len(funding) > 0:
                return float(funding[0].get('fundingRate', 0))
            return None
        except Exception as e:
            logger.error(f"Error getting funding rate for {asset}: {e}")
            return None

    async def cancel_order(self, asset: str, oid: str):
        """Cancel a specific order."""
        symbol = self._to_futures_symbol(asset)
        try:
            return await self._retry(
                lambda: self.client.futures_cancel_order(symbol=symbol, orderId=int(oid))
            )
        except Exception as e:
            logger.error(f"Error cancelling order {oid} for {asset}: {e}")
            raise

    async def cancel_all_orders(self, asset: str):
        """Cancel all open orders for an asset."""
        symbol = self._to_futures_symbol(asset)
        try:
            return await self._retry(
                lambda: self.client.futures_cancel_all_open_orders(symbol=symbol)
            )
        except Exception as e:
            logger.error(f"Error cancelling all orders for {asset}: {e}")
            raise

    async def round_size(self, asset: str, amount: float) -> float:
        """Round order size to asset precision based on LOT_SIZE filter.
        
        Args:
            asset: Asset symbol (e.g., 'BTC')
            amount: Desired size before rounding
            
        Returns:
            Rounded size
        """
        symbol = self._to_futures_symbol(asset)
        try:
            exchange_info = await self._retry(lambda: self.client.futures_exchange_info())
            symbol_info = next((s for s in exchange_info['symbols'] if s['symbol'] == symbol), None)
            
            if symbol_info:
                # Get step size from LOT_SIZE filter
                step_size = None
                for filt in symbol_info.get('filters', []):
                    if filt.get('filterType') == 'LOT_SIZE':
                        step_size = float(filt.get('stepSize', '0.001'))
                        break
                
                if step_size and step_size > 0:
                    # Round down to step size multiple
                    rounded = (amount // step_size) * step_size
                    # Format to appropriate precision
                    precision = len(str(step_size).split('.')[-1].rstrip('0'))
                    return round(rounded, precision)
            
            # Fallback: round to 3 decimals
            logger.warning(f"⚠️  Precision not found for {symbol}, using default 3 decimals")
            return round(amount, 3)
        except Exception as e:
            logger.error(f"Error rounding size for {asset}: {e}")
            return round(amount, 3)

