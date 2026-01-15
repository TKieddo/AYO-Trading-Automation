"""High-level Aster DEX exchange client with async retry helpers.

This module provides a client for Aster DEX futures trading that matches the
HyperliquidAPI interface, allowing seamless exchange switching.
"""

import asyncio
import logging
import aiohttp
import time
import math
from typing import TYPE_CHECKING, Optional, Dict, Any, List
from src.config_loader import CONFIG
from eth_account import Account as _Account
from eth_account.signers.local import LocalAccount
from eth_account.messages import encode_defunct
from eth_abi import encode as abi_encode
from web3 import Web3
import json
from decimal import Decimal

if TYPE_CHECKING:
    class Account:
        @staticmethod
        def from_key(_private_key: str) -> LocalAccount: ...
else:
    Account = _Account


class AsterAPI:
    """Facade around Aster DEX API with async convenience methods.
    
    The class owns wallet credentials, connection configuration, and provides
    coroutine helpers that keep retry semantics and logging consistent across
    the trading agent.
    """
    
    def __init__(self):
        """Initialize wallet credentials and API configuration.
        
        Raises:
            ValueError: If required Aster credentials are missing.
        """
        self.base_url = (CONFIG.get("aster_api_base") or "https://fapi.asterdex.com").rstrip("/")
        self.user_address = CONFIG.get("aster_user_address")  # Main wallet address
        self.signer_address = CONFIG.get("aster_signer_address")  # API wallet address
        self.private_key = CONFIG.get("aster_private_key")  # API wallet private key
        
        if not self.user_address or not self.signer_address or not self.private_key:
            raise ValueError(
                "Aster credentials required: ASTER_USER_ADDRESS, ASTER_SIGNER_ADDRESS, ASTER_PRIVATE_KEY"
            )
        
        # Create wallet from private key
        self.wallet = Account.from_key(self.private_key)
        
        # Verify signer address matches wallet
        if self.wallet.address.lower() != self.signer_address.lower():
            logging.warning(
                f"Signer address mismatch: wallet={self.wallet.address}, config={self.signer_address}"
            )
        
        # Cache for symbol precision
        self._precision_cache = {}
        self._meta_cache = None
        
        # Log configuration
        logging.info(f"Aster API initialized:")
        logging.info(f"   - Base URL: {self.base_url}")
        logging.info(f"   - User Address (main): {self.user_address}")
        logging.info(f"   - Signer Address (API): {self.signer_address}")
        logging.info(f"   - Wallet Address (from key): {self.wallet.address}")
    
    def _trim_dict(self, my_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Convert all parameter values to strings, matching Aster API v3 spec.
        
        This recursively processes dicts and lists, converting everything to strings.
        """
        result = {}
        for key, value in my_dict.items():
            if value is None:
                continue
            if isinstance(value, list):
                new_value = []
                for item in value:
                    if isinstance(item, dict):
                        new_value.append(json.dumps(self._trim_dict(item), separators=(',', ':')))
                    else:
                        new_value.append(str(item))
                result[key] = json.dumps(new_value, separators=(',', ':'))
            elif isinstance(value, dict):
                result[key] = json.dumps(self._trim_dict(value), separators=(',', ':'))
            else:
                result[key] = str(value)
        return result
    
    def _generate_signature(
        self, params: Dict[str, Any], nonce: int
    ) -> str:
        """Generate Aster signature following v3 API specification exactly.
        
        Args:
            params: Request parameters (will be sorted and stringified)
            nonce: Nonce in microseconds (timestamp * 1000000)
            
        Returns:
            ECDSA signature string with 0x prefix
        """
        # Step 1: Remove None values
        my_dict = {key: value for key, value in params.items() if value is not None}
        
        # Step 2: Add timestamp (as int, milliseconds) and recvWindow (as int) if not present
        # These will be converted to strings by _trim_dict
        if 'timestamp' not in my_dict:
            my_dict['timestamp'] = int(round(time.time() * 1000))  # milliseconds as int
        if 'recvWindow' not in my_dict:
            my_dict['recvWindow'] = 5000  # as int, will be converted to string
        
        # Step 3: Convert all values to strings (recursively) - this handles timestamp/recvWindow
        my_dict = self._trim_dict(my_dict)
        
        # Step 4: Generate JSON string sorted by ASCII keys, remove spaces and single quotes
        json_str = json.dumps(my_dict, sort_keys=True).replace(' ', '').replace("'", '"')
        
        # Step 5: ABI encode: ['string', 'address', 'address', 'uint256']
        encoded = abi_encode(['string', 'address', 'address', 'uint256'], 
                            [json_str, self.user_address, self.signer_address, nonce])
        
        # Step 6: Keccak hash
        w3 = Web3()
        keccak_hex = w3.keccak(encoded).hex()
        
        # Step 7: Sign using encode_defunct with hexstr (keccak_hex already has 0x prefix from .hex())
        signable_msg = encode_defunct(hexstr=keccak_hex)
        signed_message = self.wallet.sign_message(signable_message=signable_msg)
        
        # Step 8: Return signature with 0x prefix
        return '0x' + signed_message.signature.hex()
    
    async def _signed_request(
        self,
        method: str,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        data: Optional[Dict[str, Any]] = None,
    ) -> Any:
        """Make a signed request to Aster API following v3 specification.
        
        Args:
            method: HTTP method ('GET', 'POST', or 'DELETE')
            path: API endpoint path (e.g., '/fapi/v3/account')
            params: Query parameters (for GET) or body params (for POST/DELETE)
            data: Additional body data (merged with params for POST/DELETE)
            
        Returns:
            JSON response from API
        """
        if params is None:
            params = {}
        if data is None:
            data = {}
        
        # Combine params and data for signature generation
        all_params = {**params, **data}
        
        # Add timestamp and recvWindow (required for signature and request)
        timestamp_ms = int(round(time.time() * 1000))
        all_params['timestamp'] = timestamp_ms
        all_params['recvWindow'] = 5000
        
        # Generate nonce (microseconds) and signature
        nonce = math.trunc(time.time() * 1000000)  # microseconds
        signature = self._generate_signature(all_params, nonce)
        
        # Add auth parameters (convert to strings for request)
        all_params['nonce'] = str(nonce)
        all_params['user'] = self.user_address
        all_params['signer'] = self.signer_address
        all_params['signature'] = signature
        # Ensure timestamp and recvWindow are strings in the request
        all_params['timestamp'] = str(timestamp_ms)
        all_params['recvWindow'] = '5000'
        
        url = f"{self.base_url}{path}"
        
        # Make request based on method
        async with aiohttp.ClientSession() as session:
            if method == 'GET':
                # GET: all params in query string
                async with session.get(url, params=all_params) as resp:
                    if not resp.ok:
                        text = await resp.text()
                        raise Exception(f"Aster API error {resp.status}: {text}")
                    return await resp.json()
            elif method == 'DELETE':
                # DELETE: all params in request body as form data
                headers = {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'PythonApp/1.0'
                }
                async with session.delete(url, data=all_params, headers=headers) as resp:
                    if not resp.ok:
                        text = await resp.text()
                        raise Exception(f"Aster API error {resp.status}: {text}")
                    return await resp.json()
            else:  # POST
                # POST: all params in request body as form data
                headers = {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'PythonApp/1.0'
                }
                async with session.post(url, data=all_params, headers=headers) as resp:
                    if not resp.ok:
                        text = await resp.text()
                        raise Exception(f"Aster API error {resp.status}: {text}")
                    return await resp.json()

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
        raise last_err if last_err else RuntimeError("Aster retry: unknown error")

    async def round_size(self, asset: str, amount: float) -> float:
        """Round order size to asset precision based on LOT_SIZE filter.
        
        Args:
            asset: Symbol (e.g., 'BTCUSDT')
            amount: Desired size before rounding
            
        Returns:
            Rounded size
        """
        # Ensure exchange info is loaded
        if not self._meta_cache:
            await self._get_exchange_info()
        
        symbol = asset if asset.endswith('USDT') else f"{asset}USDT"
        
        # Try to get stepSize from exchange info
        step_size = None
        if self._meta_cache:
            for symbol_info in self._meta_cache.get('symbols', []):
                if symbol_info.get('symbol') == symbol:
                    for filt in symbol_info.get('filters', []):
                        if filt.get('filterType') == 'LOT_SIZE':
                            step_size_str = filt.get('stepSize', '0.001')
                            try:
                                step_size = float(step_size_str)
                                # Cache the stepSize for future use
                                if symbol not in self._precision_cache:
                                    # Calculate precision from stepSize
                                    if step_size >= 1.0:
                                        precision = 0
                                    else:
                                        step_str = step_size_str.rstrip('0').rstrip('.')
                                        if '.' in step_str:
                                            precision = len(step_str.split('.')[-1])
                                        else:
                                            precision = 0
                                    self._precision_cache[symbol] = precision
                                break
                            except (ValueError, TypeError):
                                pass
                    if step_size is not None:
                        break
        
        # Round to stepSize multiple (floor to ensure we don't exceed)
        if step_size and step_size > 0:
            rounded = math.floor(amount / step_size) * step_size
            # Get precision from cache or calculate
            precision = self._precision_cache.get(symbol, 8)
            return round(rounded, precision)
        
        # Fallback: use cached precision or safe default
        if symbol in self._precision_cache:
            precision = self._precision_cache[symbol]
            return round(amount, precision)
        
        # Last resort: use 3 decimals
        logging.warning(f"⚠️  Precision not found for {symbol}, using default 3 decimals")
        return round(amount, 3)

    async def _get_exchange_info(self) -> Dict[str, Any]:
        """Get exchange info and cache symbol precision."""
        if self._meta_cache:
            return self._meta_cache
        
        try:
            info = await self._retry(
                lambda: self._signed_request('GET', '/fapi/v3/exchangeInfo')
            )
            self._meta_cache = info
            
            # Cache precision for symbols
            for symbol_info in info.get('symbols', []):
                symbol = symbol_info.get('symbol')
                if not symbol:
                    continue
                
                # Find quantity precision from LOT_SIZE filter
                precision = 3  # safer default
                for filt in symbol_info.get('filters', []):
                    if filt.get('filterType') == 'LOT_SIZE':
                        step_size_str = filt.get('stepSize', '0.001')
                        try:
                            # Parse stepSize and calculate precision
                            step_size = float(step_size_str)
                            if step_size >= 1.0:
                                precision = 0
                            else:
                                # Count significant decimal places
                                step_str = step_size_str.rstrip('0').rstrip('.')
                                if '.' in step_str:
                                    precision = len(step_str.split('.')[-1])
                                else:
                                    precision = 0
                        except (ValueError, TypeError):
                            # Fallback: count decimal places in string
                            if '.' in step_size_str:
                                precision = len(step_size_str.rstrip('0').split('.')[-1])
                            else:
                                precision = 0
                        break
                
                self._precision_cache[symbol] = precision
                logging.debug(f"Cached precision for {symbol}: {precision} decimals")
            
            return info
        except Exception as e:
            logging.error(f"Error fetching exchange info: {e}")
            return {}
    
    async def place_buy_order(
        self, asset: str, amount: float, slippage: float = 0.01
    ) -> Dict[str, Any]:
        """Submit a market buy order.
        
        Args:
            asset: Market symbol (e.g., 'BTCUSDT')
            amount: Contract size (will be rounded)
            slippage: Not used for Aster market orders
            
        Returns:
            Order response
        """
        # Format symbol (ensure USDT suffix)
        symbol = asset if asset.endswith('USDT') else f"{asset}USDT"
        amount = await self.round_size(symbol, amount)
        
        logging.info(f"🔄 Placing BUY order: {symbol}, size: {amount}")
        
        # Get current price for quantity calculation if needed
        # Aster uses quantity, not notional
        order = await self._retry(
            lambda: self._signed_request(
                'POST',
                '/fapi/v3/order',
                data={
                    'symbol': symbol,
                    'side': 'BUY',
                    'type': 'MARKET',
                    'quantity': str(amount),
            }
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
            amount: Contract size (will be rounded)
            slippage: Not used for Aster market orders
            
        Returns:
            Order response
        """
        symbol = asset if asset.endswith('USDT') else f"{asset}USDT"
        amount = await self.round_size(symbol, amount)
        
        logging.info(f"🔄 Placing SELL order: {symbol}, size: {amount}")
        
        order = await self._retry(
            lambda: self._signed_request(
                'POST',
                '/fapi/v3/order',
                data={
                    'symbol': symbol,
                    'side': 'SELL',
                    'type': 'MARKET',
                    'quantity': str(amount),
            }
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
            amount: Contract size to close
            tp_price: Take-profit trigger price
            
        Returns:
            Order response
        """
        symbol = asset if asset.endswith('USDT') else f"{asset}USDT"
        amount = await self.round_size(symbol, amount)
        
        # Take profit: close opposite direction with stop order
        side = 'SELL' if is_buy else 'BUY'
        
        return await self._retry(
            lambda: self._signed_request(
                'POST',
                '/fapi/v3/order',
                data={
                    'symbol': symbol,
                    'side': side,
                    'type': 'TAKE_PROFIT_MARKET',
                    'quantity': str(amount),
                    'stopPrice': str(tp_price),
                    'reduceOnly': 'true',
            }
            )
        )
    
    async def place_stop_loss(
        self, asset: str, is_buy: bool, amount: float, sl_price: float
    ) -> Dict[str, Any]:
        """Create a stop-loss order.
        
        Args:
            asset: Market symbol
            is_buy: True if original position is long
            amount: Contract size to close
            sl_price: Stop-loss trigger price
            
        Returns:
            Order response
        """
        symbol = asset if asset.endswith('USDT') else f"{asset}USDT"
        amount = await self.round_size(symbol, amount)
        
        side = 'SELL' if is_buy else 'BUY'
        
        return await self._retry(
            lambda: self._signed_request(
                'POST',
                '/fapi/v3/order',
                data={
                    'symbol': symbol,
                    'side': side,
                    'type': 'STOP_MARKET',
                    'quantity': str(amount),
                    'stopPrice': str(sl_price),
                    'reduceOnly': 'true',
                }
            )
        )

    async def cancel_order(self, asset: str, oid: int) -> Dict[str, Any]:
        """Cancel a single order.
        
        Args:
            asset: Market symbol
            oid: Order ID to cancel
            
        Returns:
            Cancel response
        """
        symbol = asset if asset.endswith('USDT') else f"{asset}USDT"
        
        return await self._retry(
            lambda: self._signed_request(
                'DELETE',
                '/fapi/v3/order',
                data={
                    'symbol': symbol,
                    'orderId': str(oid),
                }
            )
        )

    async def cancel_all_orders(self, asset: str) -> Dict[str, Any]:
        """Cancel all open orders for an asset.
        
        Args:
            asset: Market symbol
            
        Returns:
            Cancel response
        """
        symbol = asset if asset.endswith('USDT') else f"{asset}USDT"
        
        return await self._retry(
            lambda: self._signed_request(
                'DELETE',
                '/fapi/v3/allOpenOrders',
                data={'symbol': symbol}
            )
        )
    
    async def set_leverage(self, asset: str, leverage: int) -> Dict[str, Any]:
        """Set leverage for a specific asset on Aster DEX.
        
        Args:
            asset: Market symbol (e.g., 'BTC')
            leverage: Leverage multiplier (e.g., 25 for 25x)
            
        Returns:
            API response
            
        Raises:
            Exception: If leverage setting fails (so caller can handle it)
        """
        symbol = asset if asset.endswith('USDT') else f"{asset}USDT"
        
        # Aster DEX uses /fapi/v3/leverage endpoint (similar to Binance)
        response = await self._retry(
            lambda: self._signed_request(
                'POST',
                '/fapi/v3/leverage',
                data={
                    'symbol': symbol,
                    'leverage': str(leverage),
                }
            )
        )
        logging.info(f"✅ Set leverage for {symbol} to {leverage}x")
        return response

    async def get_open_orders(self) -> List[Dict[str, Any]]:
        """Fetch open orders.
        
        Returns:
            List of open order dictionaries
        """
        try:
            orders = await self._retry(
                lambda: self._signed_request('GET', '/fapi/v3/openOrders')
            )
            
            # Normalize format
            if isinstance(orders, list):
                return orders
            elif isinstance(orders, dict) and 'orders' in orders:
                return orders['orders']
            return []
        except Exception as e:
            logging.error(f"Get open orders error: {e}")
            return []
    
    async def get_recent_fills(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Return recent fills.
        
        Args:
            limit: Maximum number of fills to return
            
        Returns:
            List of fill dictionaries
        """
        try:
            fills = await self._retry(
                lambda: self._signed_request(
                    'GET',
                    '/fapi/v3/userTrades',
                    params={'limit': str(limit)}
                )
            )
            
            if isinstance(fills, list):
                return fills[-limit:]
            return []
        except Exception as e:
            logging.error(f"Get recent fills error: {e}")
            return []
    
    def extract_oids(self, order_result: Dict[str, Any]) -> List[int]:
        """Extract order IDs from order response.
        
        Args:
            order_result: Order response payload
            
        Returns:
            List of order IDs
        """
        oids = []
        try:
            order_id = order_result.get('orderId')
            if order_id:
                oids.append(int(order_id))
        except (KeyError, TypeError, ValueError):
            pass
        return oids

    async def get_user_state(self) -> Dict[str, Any]:
        """Retrieve account state with positions.
        
        Returns:
            Dictionary with balance, total_value, and positions
        """
        try:
            # Get account info (v3 endpoint)
            account = await self._retry(
                lambda: self._signed_request('GET', '/fapi/v3/account')
            )
            
            # Get positions (v3 endpoint)
            positions = await self._retry(
                lambda: self._signed_request('GET', '/fapi/v3/positionRisk')
            )
            
            # Normalize positions
            enriched_positions = []
            for pos in positions:
                if isinstance(pos, dict):
                    position_amt = float(pos.get('positionAmt', 0) or 0)
                    if abs(position_amt) > 0:
                        entry_px = float(pos.get('entryPrice', 0) or 0)
                        mark_px = float(pos.get('markPrice', 0) or 0)
                        unrealized_pnl = float(pos.get('unRealizedProfit', 0) or 0)
                        
                        pos['coin'] = pos.get('symbol', '').replace('USDT', '')
                        pos['szi'] = position_amt
                        pos['entryPx'] = entry_px
                        pos['markPrice'] = mark_px
                        pos['pnl'] = unrealized_pnl
                        enriched_positions.append(pos)
            
            # Calculate totals
            total_equity = float(account.get('totalWalletBalance', 0) or 0)
            available_balance = float(account.get('availableBalance', 0) or 0)
            total_unrealized = sum(p.get('pnl', 0) for p in enriched_positions)
            
            return {
                'balance': available_balance,
                'total_value': total_equity + total_unrealized,
                'positions': enriched_positions
            }
        except Exception as e:
            logging.error(f"Get user state error: {e}")
            return {'balance': 0, 'total_value': 0, 'positions': []}
    
    async def get_current_price(self, asset: str) -> float:
        """Return the latest price for an asset.
        
        Args:
            asset: Market symbol
            
        Returns:
            Current price or 0.0 if unavailable
        """
        try:
            symbol = asset if asset.endswith('USDT') else f"{asset}USDT"
            ticker = await self._retry(
                lambda: self._signed_request(
                    'GET',
                    '/fapi/v3/ticker/price',
                    params={'symbol': symbol}
                )
            )
            
            if isinstance(ticker, dict):
                return float(ticker.get('price', 0))
            elif isinstance(ticker, list) and len(ticker) > 0:
                return float(ticker[0].get('price', 0))
            return 0.0
        except Exception as e:
            logging.error(f"Get current price error for {asset}: {e}")
            return 0.0

    async def get_meta_and_ctxs(self) -> Any:
        """Return metadata (for compatibility with Hyperliquid interface).
        
        Returns:
            Metadata dict (simplified for Aster)
        """
        if not self._meta_cache:
            await self._get_exchange_info()
        return self._meta_cache or {}
    
    async def get_open_interest(self, asset: str) -> Optional[float]:
        """Return open interest if available.
        
        Args:
            asset: Market symbol
            
        Returns:
            Open interest or None
        """
        try:
            symbol = asset if asset.endswith('USDT') else f"{asset}USDT"
            oi_data = await self._retry(
                lambda: self._signed_request(
                    'GET',
                    '/fapi/v3/openInterest',
                    params={'symbol': symbol}
                )
            )
            
            if isinstance(oi_data, dict):
                return float(oi_data.get('openInterest', 0))
            return None
        except Exception as e:
            logging.error(f"Get open interest error for {asset}: {e}")
            return None
    
    async def get_funding_rate(self, asset: str) -> Optional[float]:
        """Return the most recent funding rate.
        
        Args:
            asset: Market symbol
            
        Returns:
            Funding rate or None
        """
        try:
            symbol = asset if asset.endswith('USDT') else f"{asset}USDT"
            funding = await self._retry(
                lambda: self._signed_request(
                    'GET',
                    '/fapi/v3/premiumIndex',
                    params={'symbol': symbol}
                )
            )
            
            if isinstance(funding, dict):
                return float(funding.get('lastFundingRate', 0))
            return None
        except Exception as e:
            logging.error(f"Get funding rate error for {asset}: {e}")
            return None

