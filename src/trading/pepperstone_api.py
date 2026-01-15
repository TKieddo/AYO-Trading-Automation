"""High-level Pepperstone cTrader API client with async retry helpers.

This module provides a client for Pepperstone forex trading via cTrader Open API
that matches the Aster/Hyperliquid interface, allowing seamless exchange switching.
"""

import asyncio
import logging
import aiohttp
import time
import base64
from typing import Optional, Dict, Any, List
from src.config_loader import CONFIG

# Note: Using direct REST API calls instead of SDK for better control and compatibility


class PepperstoneAPI:
    """Facade around Pepperstone cTrader API with async convenience methods.
    
    The class owns API credentials, connection configuration, and provides
    coroutine helpers that keep retry semantics and logging consistent across
    the trading agent.
    """
    
    def __init__(self):
        """Initialize API credentials and configuration.
        
        Raises:
            ValueError: If required Pepperstone credentials are missing.
            ImportError: If cTrader Open API SDK is not installed.
        """
        self.client_id = CONFIG.get("pepperstone_client_id")
        self.client_secret = CONFIG.get("pepperstone_client_secret")
        self.account_id = CONFIG.get("pepperstone_account_id")
        self.environment = CONFIG.get("pepperstone_environment", "demo").lower()  # "demo" or "live"
        
        if not self.client_id or not self.client_secret:
            raise ValueError(
                "Pepperstone credentials required: PEPPERSTONE_CLIENT_ID, PEPPERSTONE_CLIENT_SECRET"
            )
        
        # cTrader Open API endpoints
        # Demo: https://openapi-demo.ctrader.com
        # Live: https://openapi.ctrader.com
        if self.environment == "live":
            self.api_url = "https://openapi.ctrader.com"
        else:
            self.api_url = "https://openapi-demo.ctrader.com"
        
        # Cache for symbol info
        self._symbol_cache = {}
        self._account_info_cache = None
        
        # Authentication token (will be set on first request)
        self._access_token = None
        self._token_expires_at = 0
        
        logging.info(f"Pepperstone cTrader API initialized:")
        logging.info(f"   - Environment: {self.environment}")
        logging.info(f"   - API URL: {self.api_url}")
        logging.info(f"   - Account ID: {self.account_id}")
    
    async def _authenticate(self):
        """Authenticate and get access token."""
        if self._access_token and time.time() < self._token_expires_at:
            return self._access_token
        
        try:
            # Create basic auth header
            credentials = f"{self.client_id}:{self.client_secret}"
            encoded = base64.b64encode(credentials.encode()).decode()
            
            headers = {
                "Authorization": f"Basic {encoded}",
                "Content-Type": "application/x-www-form-urlencoded"
            }
            
            data = {
                "grant_type": "client_credentials",
                "scope": "trading"
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.api_url}/connect/token",
                    headers=headers,
                    data=data
                ) as resp:
                    if not resp.ok:
                        text = await resp.text()
                        raise Exception(f"Pepperstone auth error {resp.status}: {text}")
                    
                    result = await resp.json()
                    self._access_token = result.get("access_token")
                    expires_in = result.get("expires_in", 3600)
                    self._token_expires_at = time.time() + expires_in - 60  # Refresh 1 min early
                    
                    logging.info("✅ Pepperstone authentication successful")
                    return self._access_token
        except Exception as e:
            logging.error(f"Pepperstone authentication failed: {e}")
            raise
    
    async def _signed_request(
        self,
        method: str,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        data: Optional[Dict[str, Any]] = None,
    ) -> Any:
        """Make an authenticated request to Pepperstone cTrader API.
        
        Args:
            method: HTTP method ('GET', 'POST', 'DELETE')
            path: API endpoint path
            params: Query parameters
            data: Request body data
            
        Returns:
            JSON response
        """
        await self._authenticate()
        
        headers = {
            "Authorization": f"Bearer {self._access_token}",
            "Content-Type": "application/json"
        }
        
        url = f"{self.api_url}{path}"
        
        async with aiohttp.ClientSession() as session:
            if method == "GET":
                async with session.get(url, params=params, headers=headers) as resp:
                    if not resp.ok:
                        text = await resp.text()
                        raise Exception(f"Pepperstone API error {resp.status}: {text}")
                    return await resp.json()
            elif method == "POST":
                async with session.post(url, json=data, headers=headers) as resp:
                    if not resp.ok:
                        text = await resp.text()
                        raise Exception(f"Pepperstone API error {resp.status}: {text}")
                    return await resp.json()
            elif method == "DELETE":
                async with session.delete(url, params=params, headers=headers) as resp:
                    if not resp.ok:
                        text = await resp.text()
                        raise Exception(f"Pepperstone API error {resp.status}: {text}")
                    return await resp.json()
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
    
    async def _retry(
        self,
        fn,
        *args,
        max_attempts: int = 3,
        backoff_base: float = 0.5,
        **kwargs
    ):
        """Retry helper with exponential backoff.
        
        Args:
            fn: Async callable to invoke
            *args: Positional arguments
            max_attempts: Maximum retry attempts
            backoff_base: Initial backoff delay
            **kwargs: Keyword arguments
            
        Returns:
            Result from fn
        """
        last_err = None
        for attempt in range(max_attempts):
            try:
                return await fn(*args, **kwargs)
            except (aiohttp.ClientError, ConnectionError, TimeoutError) as e:
                last_err = e
                if attempt < max_attempts - 1:
                    await asyncio.sleep(backoff_base * (2 ** attempt))
                    continue
                raise
            except Exception as e:
                last_err = e
                if attempt < max_attempts - 1:
                    await asyncio.sleep(backoff_base * (2 ** attempt))
                    continue
                raise
        raise last_err if last_err else RuntimeError("Pepperstone retry: unknown error")
    
    def _format_symbol(self, asset: str) -> str:
        """Format asset symbol for cTrader (e.g., 'EURUSD' -> 'EURUSD').
        
        Args:
            asset: Asset symbol (e.g., 'EURUSD', 'EUR_USD', 'GBPUSD')
            
        Returns:
            Formatted symbol (e.g., 'EURUSD')
        """
        # Remove underscores/slashes and convert to uppercase
        symbol = asset.upper().replace("_", "").replace("/", "")
        
        # Common forex pairs
        forex_pairs = {
            "EURUSD": "EURUSD",
            "GBPUSD": "GBPUSD",
            "USDJPY": "USDJPY",
            "AUDUSD": "AUDUSD",
            "USDCAD": "USDCAD",
            "USDCHF": "USDCHF",
            "NZDUSD": "NZDUSD",
            "EURGBP": "EURGBP",
            "EURJPY": "EURJPY",
            "GBPJPY": "GBPJPY",
        }
        
        return forex_pairs.get(symbol, symbol)
    
    async def _get_symbol_info(self, symbol: str) -> Dict[str, Any]:
        """Get symbol information and cache it.
        
        Args:
            symbol: Symbol name (e.g., 'EURUSD')
            
        Returns:
            Symbol information dictionary
        """
        if symbol in self._symbol_cache:
            return self._symbol_cache[symbol]
        
        try:
            # Get all symbols
            response = await self._retry(
                lambda: self._signed_request("GET", "/v1/symbols")
            )
            
            # Find our symbol
            for sym_info in response.get("symbols", []):
                if sym_info.get("name") == symbol:
                    self._symbol_cache[symbol] = sym_info
                    return sym_info
            
            logging.warning(f"Symbol {symbol} not found")
            return {}
        except Exception as e:
            logging.error(f"Error fetching symbol info for {symbol}: {e}")
            return {}
    
    async def round_size(self, asset: str, amount: float) -> float:
        """Round order size to lot size precision.
        
        Args:
            asset: Symbol (e.g., 'EURUSD')
            amount: Desired lot size before rounding
            
        Returns:
            Rounded lot size
        """
        symbol = self._format_symbol(asset)
        symbol_info = await self._get_symbol_info(symbol)
        
        # Default lot size step is 0.01 (mini lot)
        lot_step = float(symbol_info.get("lotStep", 0.01))
        min_lot = float(symbol_info.get("lotMin", 0.01))
        max_lot = float(symbol_info.get("lotMax", 100.0))
        
        # Round to lot step
        rounded = round(amount / lot_step) * lot_step
        
        # Clamp to min/max
        rounded = max(min_lot, min(max_lot, rounded))
        
        return rounded
    
    async def get_current_price(self, asset: str) -> float:
        """Return the latest mid-price for asset.
        
        Args:
            asset: Market symbol to query (e.g., 'EURUSD')
            
        Returns:
            Mid-price as a float, or 0.0 when unavailable
        """
        try:
            symbol = self._format_symbol(asset)
            
            # Get price from market data
            response = await self._retry(
                lambda: self._signed_request(
                    "GET",
                    f"/v1/market-data/{symbol}",
                    params={"accountId": self.account_id}
                )
            )
            
            bid = float(response.get("bid", 0))
            ask = float(response.get("ask", 0))
            
            if bid > 0 and ask > 0:
                return (bid + ask) / 2.0
            
            return 0.0
        except Exception as e:
            logging.error(f"Error getting price for {asset}: {e}")
            return 0.0
    
    async def place_buy_order(
        self, asset: str, amount: float, slippage: float = 0.01
    ) -> Dict[str, Any]:
        """Submit a market buy order.
        
        Args:
            asset: Market symbol (e.g., 'EURUSD')
            amount: Lot size (will be rounded)
            slippage: Not used for market orders
            
        Returns:
            Order response
        """
        symbol = self._format_symbol(asset)
        lot_size = await self.round_size(asset, amount)
        
        logging.info(f"🔄 Placing BUY order: {symbol}, lot size: {lot_size}")
        
        order_data = {
            "symbolName": symbol,
            "volume": lot_size,
            "orderType": "Market",
            "positionId": 0,  # 0 for new position
            "tradeSide": "buy"
        }
        
        order = await self._retry(
            lambda: self._signed_request(
                "POST",
                f"/v1/orders/{self.account_id}",
                data=order_data
            )
        )
        
        logging.info(f"📋 BUY order response: {order}")
        return order
    
    async def place_sell_order(
        self, asset: str, amount: float, slippage: float = 0.01
    ) -> Dict[str, Any]:
        """Submit a market sell order.
        
        Args:
            asset: Market symbol
            amount: Lot size (will be rounded)
            slippage: Not used for market orders
            
        Returns:
            Order response
        """
        symbol = self._format_symbol(asset)
        lot_size = await self.round_size(asset, amount)
        
        logging.info(f"🔄 Placing SELL order: {symbol}, lot size: {lot_size}")
        
        order_data = {
            "symbolName": symbol,
            "volume": lot_size,
            "orderType": "Market",
            "positionId": 0,  # 0 for new position
            "tradeSide": "sell"
        }
        
        order = await self._retry(
            lambda: self._signed_request(
                "POST",
                f"/v1/orders/{self.account_id}",
                data=order_data
            )
        )
        
        logging.info(f"📋 SELL order response: {order}")
        return order
    
    async def place_take_profit(
        self, asset: str, is_buy: bool, amount: float, tp_price: float
    ) -> Dict[str, Any]:
        """Create a take-profit order.
        
        Args:
            asset: Market symbol
            is_buy: True if original position is long
            amount: Lot size to close
            tp_price: Take-profit trigger price
            
        Returns:
            Order response
        """
        symbol = self._format_symbol(asset)
        lot_size = await self.round_size(asset, amount)
        
        # Get position ID (simplified - in production, you'd track this)
        positions = await self.get_user_state()
        position_id = None
        
        for pos in positions.get("positions", []):
            if pos.get("symbol") == symbol:
                position_id = pos.get("positionId")
                break
        
        if not position_id:
            raise ValueError(f"No open position found for {symbol}")
        
        order_data = {
            "symbolName": symbol,
            "volume": lot_size,
            "orderType": "Limit",
            "positionId": position_id,
            "tradeSide": "sell" if is_buy else "buy",
            "limitPrice": tp_price
        }
        
        return await self._retry(
            lambda: self._signed_request(
                "POST",
                f"/v1/orders/{self.account_id}",
                data=order_data
            )
        )
    
    async def place_stop_loss(
        self, asset: str, is_buy: bool, amount: float, sl_price: float
    ) -> Dict[str, Any]:
        """Create a stop-loss order.
        
        Args:
            asset: Market symbol
            is_buy: True if original position is long
            amount: Lot size to close
            sl_price: Stop-loss trigger price
            
        Returns:
            Order response
        """
        symbol = self._format_symbol(asset)
        lot_size = await self.round_size(asset, amount)
        
        # Get position ID
        positions = await self.get_user_state()
        position_id = None
        
        for pos in positions.get("positions", []):
            if pos.get("symbol") == symbol:
                position_id = pos.get("positionId")
                break
        
        if not position_id:
            raise ValueError(f"No open position found for {symbol}")
        
        order_data = {
            "symbolName": symbol,
            "volume": lot_size,
            "orderType": "Stop",
            "positionId": position_id,
            "tradeSide": "sell" if is_buy else "buy",
            "stopPrice": sl_price
        }
        
        return await self._retry(
            lambda: self._signed_request(
                "POST",
                f"/v1/orders/{self.account_id}",
                data=order_data
            )
        )
    
    async def cancel_order(self, asset: str, oid: int) -> Dict[str, Any]:
        """Cancel an order by order ID.
        
        Args:
            asset: Market symbol (for logging)
            oid: Order ID to cancel
            
        Returns:
            Cancellation response
        """
        logging.info(f"🔄 Cancelling order: {asset}, order ID: {oid}")
        
        return await self._retry(
            lambda: self._signed_request(
                "DELETE",
                f"/v1/orders/{self.account_id}/{oid}"
            )
        )
    
    async def cancel_all_orders(self, asset: str) -> Dict[str, Any]:
        """Cancel all open orders for a symbol.
        
        Args:
            asset: Market symbol
            
        Returns:
            Cancellation response
        """
        symbol = self._format_symbol(asset)
        logging.info(f"🔄 Cancelling all orders for: {symbol}")
        
        orders = await self.get_open_orders()
        cancelled = []
        
        for order in orders:
            if order.get("symbolName") == symbol:
                try:
                    result = await self.cancel_order(asset, order.get("orderId"))
                    cancelled.append(result)
                except Exception as e:
                    logging.error(f"Error cancelling order {order.get('orderId')}: {e}")
        
        return {"cancelled": len(cancelled), "orders": cancelled}
    
    async def get_open_orders(self) -> List[Dict[str, Any]]:
        """Get all open orders.
        
        Returns:
            List of open orders
        """
        try:
            response = await self._retry(
                lambda: self._signed_request(
                    "GET",
                    f"/v1/orders/{self.account_id}"
                )
            )
            
            orders = response.get("orders", [])
            
            # Normalize order format
            normalized = []
            for order in orders:
                normalized.append({
                    "orderId": order.get("orderId"),
                    "symbol": order.get("symbolName", "").replace("USDT", ""),
                    "symbolName": order.get("symbolName"),
                    "side": order.get("tradeSide", "").upper(),
                    "type": order.get("orderType", ""),
                    "volume": float(order.get("volume", 0)),
                    "price": float(order.get("limitPrice") or order.get("stopPrice") or 0),
                    "status": order.get("orderStatus", ""),
                })
            
            return normalized
        except Exception as e:
            logging.error(f"Error getting open orders: {e}")
            return []
    
    def extract_oids(self, order_result: Dict[str, Any]) -> List[int]:
        """Extract order IDs from order result.
        
        Args:
            order_result: Order response dictionary
            
        Returns:
            List of order IDs
        """
        oids = []
        try:
            if isinstance(order_result, dict):
                if "orderId" in order_result:
                    oids.append(int(order_result["orderId"]))
                if "orders" in order_result:
                    for order in order_result["orders"]:
                        if isinstance(order, dict) and "orderId" in order:
                            oids.append(int(order["orderId"]))
        except (KeyError, TypeError, ValueError):
            pass
        return oids
    
    async def get_user_state(self) -> Dict[str, Any]:
        """Retrieve account state with positions.
        
        Returns:
            Dictionary with balance, total_value, and positions
        """
        try:
            # Get account info
            account_response = await self._retry(
                lambda: self._signed_request(
                    "GET",
                    f"/v1/accounts/{self.account_id}"
                )
            )
            
            # Get positions
            positions_response = await self._retry(
                lambda: self._signed_request(
                    "GET",
                    f"/v1/positions/{self.account_id}"
                )
            )
            
            # Extract balance
            balance = float(account_response.get("balance", 0))
            equity = float(account_response.get("equity", balance))
            
            # Normalize positions
            enriched_positions = []
            for pos in positions_response.get("positions", []):
                position_volume = float(pos.get("volume", 0))
                if abs(position_volume) > 0:
                    symbol = pos.get("symbolName", "")
                    entry_price = float(pos.get("openPrice", 0))
                    current_price = await self.get_current_price(symbol)
                    
                    # Calculate PnL
                    if position_volume > 0:  # Long
                        pnl = (current_price - entry_price) * abs(position_volume) * 100000  # 1 lot = 100k units
                    else:  # Short
                        pnl = (entry_price - current_price) * abs(position_volume) * 100000
                    
                    enriched_positions.append({
                        "coin": symbol.replace("USD", "").replace("JPY", "").replace("EUR", "").replace("GBP", ""),
                        "symbol": symbol,
                        "szi": position_volume,
                        "entryPx": entry_price,
                        "markPrice": current_price,
                        "pnl": pnl,
                        "positionId": pos.get("positionId"),
                    })
            
            total_unrealized = sum(p.get("pnl", 0) for p in enriched_positions)
            
            return {
                "balance": balance,
                "total_value": equity,
                "positions": enriched_positions
            }
        except Exception as e:
            logging.error(f"Get user state error: {e}")
            return {
                "balance": 0.0,
                "total_value": 0.0,
                "positions": []
            }
