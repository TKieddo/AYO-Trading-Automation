"""Alert monitor service - continuously monitors markets and sends signals to agent."""

import asyncio
import aiohttp
import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from src.alert_service.pinescript_strategy import PineScriptStrategy
from src.config_loader import CONFIG, get_timeframe_for_asset


class AlertMonitor:
    """Continuously monitors market conditions and sends trading signals to agent."""
    
    def __init__(self):
        """Initialize alert monitor with configuration."""
        self.logger = logging.getLogger("alert.monitor")
        
        # Initialize exchange based on CONFIG (Aster or Binance)
        exchange_name = CONFIG.get("exchange", "aster").lower()
        if exchange_name == "aster":
            from src.trading.aster_api import AsterAPI
            self.exchange = AsterAPI()
            self.logger.info("Using Aster DEX for alert service")
        elif exchange_name == "binance":
            from src.trading.binance_api import BinanceAPI
            self.exchange = BinanceAPI()
            testnet = CONFIG.get("binance_testnet", False)
            self.logger.info(f"Using Binance Futures ({'testnet' if testnet else 'mainnet'}) for alert service")
        else:
            raise ValueError(f"Unknown exchange: {exchange_name}. Use 'aster' or 'binance'")
        
        # Configuration
        self.check_interval = CONFIG.get("ALERT_CHECK_INTERVAL", 5)  # seconds
        self.agent_endpoint = CONFIG.get("ALERT_AGENT_ENDPOINT", "http://localhost:5000/api/alert/signal")
        self.assets = self._parse_assets(CONFIG.get("ALERT_ASSETS", "BTC,ETH,SOL"))
        default_timeframe = CONFIG.get("ALERT_TIMEFRAME", "5m")
        
        # Create strategy instances per asset (for per-asset timeframes)
        self.strategies = {}
        for asset in self.assets:
            asset_timeframe = get_timeframe_for_asset(asset, default_timeframe)
            self.strategies[asset] = PineScriptStrategy(timeframe=asset_timeframe)
            self.logger.info(f"Asset {asset}: using {asset_timeframe} timeframe")
        
        # Track last signals to avoid duplicates
        self.last_signals = {}  # {asset: {action, timestamp}}
        self.signal_cooldown = 300  # 5 minutes cooldown per asset per action
        
        self.logger.info(f"Alert Monitor initialized: {len(self.assets)} assets, check interval: {self.check_interval}s")
        self.logger.info(f"Agent endpoint: {self.agent_endpoint}")
    
    def _parse_assets(self, assets_str: str) -> List[str]:
        """Parse assets from comma-separated string."""
        if not assets_str:
            return []
        return [a.strip().upper() for a in assets_str.split(",") if a.strip()]
    
    async def get_current_price(self, asset: str) -> Optional[float]:
        """Get current price for an asset."""
        try:
            price = await self.exchange.get_current_price(asset)
            return float(price) if price else None
        except Exception as e:
            self.logger.error(f"Error getting price for {asset}: {e}")
            return None
    
    async def check_and_send_signals(self):
        """Check all assets for signals and send to agent."""
        for asset in self.assets:
            try:
                # Get current price
                current_price = await self.get_current_price(asset)
                if not current_price or current_price <= 0:
                    continue
                
                # Get strategy for this asset (with per-asset timeframe)
                strategy = self.strategies.get(asset)
                if not strategy:
                    continue
                
                # Check for signal
                signal = strategy.check_signal(asset, current_price)
                if not signal:
                    continue
                
                # Check cooldown to avoid duplicate signals
                if self._should_skip_signal(asset, signal["action"]):
                    continue
                
                # Add timestamp
                signal["timestamp"] = datetime.now(timezone.utc).isoformat()
                
                # Send signal to agent
                await self._send_signal_to_agent(signal)
                
                # Update last signal tracking
                self.last_signals[asset] = {
                    "action": signal["action"],
                    "timestamp": datetime.now(timezone.utc)
                }
                
            except Exception as e:
                self.logger.error(f"Error checking signal for {asset}: {e}")
                continue
    
    def _should_skip_signal(self, asset: str, action: str) -> bool:
        """Check if we should skip this signal due to cooldown."""
        if asset not in self.last_signals:
            return False
        
        last = self.last_signals[asset]
        if last["action"] != action:
            return False  # Different action, allow
        
        # Check cooldown
        time_since = (datetime.now(timezone.utc) - last["timestamp"]).total_seconds()
        if time_since < self.signal_cooldown:
            self.logger.debug(f"Skipping {asset} {action} signal (cooldown: {int(self.signal_cooldown - time_since)}s remaining)")
            return True
        
        return False
    
    async def _send_signal_to_agent(self, signal: Dict[str, Any]):
        """Send trading signal to agent via HTTP POST."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.agent_endpoint,
                    json=signal,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        self.logger.info(
                            f"Signal sent: {signal['asset']} {signal['action']} @ ${signal['price']:.2f} "
                            f"(TP: ${signal['tp_price']:.2f}, SL: ${signal['sl_price']:.2f})"
                        )
                        return result
                    else:
                        error_text = await response.text()
                        self.logger.error(
                            f"Failed to send signal: {signal['asset']} {signal['action']} - "
                            f"Status {response.status}: {error_text}"
                        )
                        return None
        except asyncio.TimeoutError:
            self.logger.error(f"Timeout sending signal to agent: {signal['asset']} {signal['action']}")
        except Exception as e:
            self.logger.error(f"Error sending signal to agent: {signal['asset']} {signal['action']} - {e}")
    
    async def run(self):
        """Main monitoring loop - runs continuously."""
        self.logger.info("Alert Monitor starting...")
        self.logger.info(f"Monitoring {len(self.assets)} assets: {', '.join(self.assets)}")
        
        while True:
            try:
                await self.check_and_send_signals()
                await asyncio.sleep(self.check_interval)
            except KeyboardInterrupt:
                self.logger.info("🛑 Alert Monitor stopping (KeyboardInterrupt)...")
                break
            except Exception as e:
                self.logger.error(f"Error in monitoring loop: {e}")
                await asyncio.sleep(self.check_interval)


