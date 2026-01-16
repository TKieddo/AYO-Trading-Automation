"""Multi-exchange manager for trading on multiple exchanges simultaneously.

This module allows trading crypto (Aster/Hyperliquid) and forex (Pepperstone) at the same time.
"""

import logging
from typing import Dict, Any, List, Optional, Tuple
from src.config_loader import CONFIG


class MultiExchangeManager:
    """Manages multiple exchanges simultaneously for multi-asset trading."""
    
    def __init__(self):
        """Initialize exchanges based on configuration."""
        self.exchanges: Dict[str, Any] = {}
        self.asset_to_exchange: Dict[str, str] = {}
        self.exchange_configs: Dict[str, Dict[str, Any]] = {}
        
        # Load exchange configurations
        self._load_exchanges()
        self._map_assets_to_exchanges()
    
    def _load_exchanges(self):
        """Load and initialize all configured exchanges."""
        # Check for Aster (crypto)
        aster_user = CONFIG.get("aster_user_address")
        aster_signer = CONFIG.get("aster_signer_address")
        aster_key = CONFIG.get("aster_private_key")
        
        if aster_user and aster_signer and aster_key:
            try:
                from src.trading.aster_api import AsterAPI
                self.exchanges["aster"] = AsterAPI()
                self.exchange_configs["aster"] = {
                    "type": "crypto",
                    "name": "Aster DEX"
                }
                logging.info("✅ Initialized Aster DEX for crypto trading")
            except Exception as e:
                logging.error(f"❌ Failed to initialize Aster: {e}")
        
        # Check for Binance (crypto)
        binance_key = CONFIG.get("binance_api_key")
        binance_secret = CONFIG.get("binance_api_secret")
        if binance_key and binance_secret:
            try:
                from src.trading.binance_api import BinanceAPI
                self.exchanges["binance"] = BinanceAPI()
                testnet = CONFIG.get("binance_testnet", False)
                self.exchange_configs["binance"] = {
                    "type": "crypto",
                    "name": "Binance Futures",
                    "testnet": testnet
                }
                logging.info(f"✅ Initialized Binance Futures ({'testnet' if testnet else 'mainnet'}) for crypto trading")
            except Exception as e:
                logging.error(f"❌ Failed to initialize Binance: {e}")
        
        # Check for Hyperliquid (crypto fallback)
        hyperliquid_key = CONFIG.get("hyperliquid_private_key")
        if hyperliquid_key and "aster" not in self.exchanges and "binance" not in self.exchanges:
            try:
                from src.trading.hyperliquid_api import HyperliquidAPI
                self.exchanges["hyperliquid"] = HyperliquidAPI()
                self.exchange_configs["hyperliquid"] = {
                    "type": "crypto",
                    "name": "Hyperliquid"
                }
                logging.info("✅ Initialized Hyperliquid for crypto trading")
            except Exception as e:
                logging.error(f"❌ Failed to initialize Hyperliquid: {e}")
        
        # Check for Pepperstone (forex)
        pepperstone_client_id = CONFIG.get("pepperstone_client_id")
        pepperstone_client_secret = CONFIG.get("pepperstone_client_secret")
        
        if pepperstone_client_id and pepperstone_client_secret:
            try:
                from src.trading.pepperstone_api import PepperstoneAPI
                self.exchanges["pepperstone"] = PepperstoneAPI()
                environment = CONFIG.get("pepperstone_environment", "demo")
                self.exchange_configs["pepperstone"] = {
                    "type": "forex",
                    "name": "Pepperstone cTrader",
                    "environment": environment
                }
                logging.info(f"✅ Initialized Pepperstone cTrader ({environment}) for forex trading")
            except Exception as e:
                logging.error(f"❌ Failed to initialize Pepperstone: {e}")
        
        if not self.exchanges:
            raise ValueError("No exchanges configured! Please set up at least one exchange.")
        
        logging.info(f"📊 Multi-exchange manager initialized with {len(self.exchanges)} exchange(s)")
        for name, config in self.exchange_configs.items():
            logging.info(f"   - {config['name']} ({config['type']})")
    
    def _map_assets_to_exchanges(self):
        """Map assets to their appropriate exchanges.
        
        Uses CRYPTO_ASSETS and FOREX_ASSETS from config to explicitly map:
        - Crypto assets -> Aster/Hyperliquid
        - Forex pairs -> Pepperstone
        """
        # Get explicit asset lists from config
        crypto_assets_list = CONFIG.get("crypto_assets_list", [])
        forex_assets_list = CONFIG.get("forex_assets_list", [])
        
        # Map crypto assets to crypto exchange
        for asset in crypto_assets_list:
            asset_upper = asset.upper()
            if "aster" in self.exchanges:
                self.asset_to_exchange[asset_upper] = "aster"
                logging.debug(f"📌 Mapped crypto asset {asset_upper} -> Aster")
            elif "binance" in self.exchanges:
                self.asset_to_exchange[asset_upper] = "binance"
                logging.debug(f"📌 Mapped crypto asset {asset_upper} -> Binance")
            elif "hyperliquid" in self.exchanges:
                self.asset_to_exchange[asset_upper] = "hyperliquid"
                logging.debug(f"📌 Mapped crypto asset {asset_upper} -> Hyperliquid")
            else:
                logging.warning(f"⚠️  No crypto exchange available for {asset_upper}")
        
        # Map forex assets to forex exchange
        for asset in forex_assets_list:
            asset_upper = asset.upper()
            if "pepperstone" in self.exchanges:
                self.asset_to_exchange[asset_upper] = "pepperstone"
                logging.debug(f"📌 Mapped forex asset {asset_upper} -> Pepperstone")
            else:
                logging.warning(f"⚠️  No forex exchange available for {asset_upper}")
        
        # Log mapping summary
        if crypto_assets_list or forex_assets_list:
            logging.info(f"✅ Asset mapping complete: {len(crypto_assets_list)} crypto, {len(forex_assets_list)} forex")
        else:
            logging.warning("⚠️  No assets configured in CRYPTO_ASSETS or FOREX_ASSETS")
    
    def get_exchange_for_asset(self, asset: str) -> Optional[Any]:
        """Get the appropriate exchange for an asset.
        
        Args:
            asset: Asset symbol (e.g., 'BTC', 'EURUSD')
            
        Returns:
            Exchange instance or None
        """
        asset_upper = asset.upper()
        
        # Check explicit mapping first (from CRYPTO_ASSETS/FOREX_ASSETS)
        if asset_upper in self.asset_to_exchange:
            exchange_name = self.asset_to_exchange[asset_upper]
            exchange = self.exchanges.get(exchange_name)
            if exchange:
                return exchange
            else:
                logging.warning(f"⚠️  Exchange '{exchange_name}' not found for asset {asset_upper}")
        
        # Fallback: Auto-detect based on asset format (for backward compatibility)
        # Forex pairs typically have 6+ characters and contain currency codes
        forex_indicators = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD"]
        if len(asset_upper) >= 6 and any(fx in asset_upper for fx in forex_indicators):
            if "pepperstone" in self.exchanges:
                logging.debug(f"🔍 Auto-detected {asset_upper} as forex -> Pepperstone")
                return self.exchanges["pepperstone"]
        
        # Default to crypto exchange
        if "aster" in self.exchanges:
            logging.debug(f"🔍 Auto-detected {asset_upper} as crypto -> Aster")
            return self.exchanges["aster"]
        elif "binance" in self.exchanges:
            logging.debug(f"🔍 Auto-detected {asset_upper} as crypto -> Binance")
            return self.exchanges["binance"]
        elif "hyperliquid" in self.exchanges:
            logging.debug(f"🔍 Auto-detected {asset_upper} as crypto -> Hyperliquid")
            return self.exchanges["hyperliquid"]
        
        logging.error(f"❌ No exchange found for asset {asset_upper}")
        return None
    
    def get_exchange_name_for_asset(self, asset: str) -> Optional[str]:
        """Get the exchange name for an asset.
        
        Args:
            asset: Asset symbol
            
        Returns:
            Exchange name or None
        """
        asset_upper = asset.upper()
        
        if asset_upper in self.asset_to_exchange:
            return self.asset_to_exchange[asset_upper]
        
        # Auto-detect
        forex_indicators = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD"]
        if len(asset_upper) >= 6 and any(fx in asset_upper for fx in forex_indicators):
            return "pepperstone" if "pepperstone" in self.exchanges else None
        
        if "aster" in self.exchanges:
            return "aster"
        elif "binance" in self.exchanges:
            return "binance"
        elif "hyperliquid" in self.exchanges:
            return "hyperliquid"
        return None
    
    async def get_all_positions(self) -> Dict[str, List[Dict[str, Any]]]:
        """Get positions from all exchanges.
        
        Returns:
            Dictionary mapping exchange names to their positions
        """
        all_positions = {}
        
        for exchange_name, exchange in self.exchanges.items():
            try:
                state = await exchange.get_user_state()
                positions = state.get("positions", [])
                
                # Add exchange info to each position
                for pos in positions:
                    pos["exchange"] = exchange_name
                    pos["exchange_type"] = self.exchange_configs[exchange_name]["type"]
                
                all_positions[exchange_name] = positions
            except Exception as e:
                logging.error(f"Error getting positions from {exchange_name}: {e}")
                all_positions[exchange_name] = []
        
        return all_positions
    
    async def get_all_balances(self) -> Dict[str, Dict[str, float]]:
        """Get balances from all exchanges.
        
        Returns:
            Dictionary mapping exchange names to their balance info
        """
        all_balances = {}
        
        for exchange_name, exchange in self.exchanges.items():
            try:
                state = await exchange.get_user_state()
                all_balances[exchange_name] = {
                    "balance": state.get("balance", 0.0),
                    "total_value": state.get("total_value", 0.0),
                    "exchange_type": self.exchange_configs[exchange_name]["type"]
                }
            except Exception as e:
                logging.error(f"Error getting balance from {exchange_name}: {e}")
                all_balances[exchange_name] = {
                    "balance": 0.0,
                    "total_value": 0.0,
                    "exchange_type": self.exchange_configs[exchange_name]["type"]
                }
        
        return all_balances
    
    def get_exchanges_by_type(self, exchange_type: str) -> Dict[str, Any]:
        """Get all exchanges of a specific type.
        
        Args:
            exchange_type: "crypto" or "forex"
            
        Returns:
            Dictionary of exchange name -> exchange instance
        """
        return {
            name: exchange
            for name, exchange in self.exchanges.items()
            if self.exchange_configs[name]["type"] == exchange_type
        }
    
    def list_exchanges(self) -> List[str]:
        """List all active exchange names.
        
        Returns:
            List of exchange names
        """
        return list(self.exchanges.keys())
    
    def has_exchange(self, exchange_name: str) -> bool:
        """Check if an exchange is available.
        
        Args:
            exchange_name: Exchange name to check
            
        Returns:
            True if exchange is available
        """
        return exchange_name in self.exchanges
