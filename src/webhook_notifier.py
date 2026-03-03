"""
Webhook notifier for sending trade alerts to external services (WhatsApp, Discord, etc.)
"""

import aiohttp
import logging
import json
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class WebhookNotifier:
    """Sends trade notifications via HTTP webhooks"""
    
    def __init__(self, webhook_url: Optional[str] = None):
        self.webhook_url = webhook_url
        self.enabled = bool(webhook_url)
        
        if self.enabled:
            logger.info(f"🔔 Webhook notifier enabled: {webhook_url}")
        else:
            logger.info("🔕 Webhook notifier disabled (no WEBHOOK_URL configured)")
    
    async def send_notification(self, event_type: str, data: Dict[str, Any]) -> bool:
        """Send notification to webhook"""
        if not self.enabled or not self.webhook_url:
            return False
        
        try:
            payload = {
                "event": event_type,
                "timestamp": data.get("timestamp", ""),
                "data": data
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.webhook_url,
                    json=payload,
                    headers={"Content-Type": "application/json"},
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status == 200:
                        logger.debug(f"✅ Webhook sent: {event_type}")
                        return True
                    else:
                        logger.warning(f"⚠️ Webhook failed: {response.status} for {event_type}")
                        return False
                        
        except Exception as e:
            logger.error(f"❌ Webhook error: {e}")
            return False
    
    async def notify_entry(self, asset: str, side: str, price: float, 
                          size: float, leverage: int, reason: str = ""):
        """Notify on position entry"""
        await self.send_notification("ENTRY", {
            "asset": asset,
            "side": side,
            "price": price,
            "size": size,
            "leverage": leverage,
            "reason": reason,
            "timestamp": str(datetime.now(timezone.utc))
        })
    
    async def notify_exit(self, asset: str, side: str, entry_price: float,
                         exit_price: float, pnl_percent: float, pnl_usd: float,
                         reason: str, size: float):
        """Notify on position exit"""
        await self.send_notification("EXIT", {
            "asset": asset,
            "side": side,
            "entry_price": entry_price,
            "exit_price": exit_price,
            "pnl_percent": pnl_percent,
            "pnl_usd": pnl_usd,
            "reason": reason,
            "size": size,
            "timestamp": str(datetime.now(timezone.utc))
        })
    
    async def notify_pair_hunter(self, top_pairs: list, positions: list):
        """Notify on pair hunter refresh"""
        await self.send_notification("PAIR_HUNTER", {
            "top_pairs": top_pairs,
            "current_positions": positions,
            "timestamp": str(datetime.now(timezone.utc))
        })
    
    async def notify_error(self, error_type: str, message: str, asset: str = ""):
        """Notify on errors"""
        await self.send_notification("ERROR", {
            "error_type": error_type,
            "message": message,
            "asset": asset,
            "timestamp": str(datetime.now(timezone.utc))
        })


# Import here to avoid circular imports
from datetime import datetime, timezone
