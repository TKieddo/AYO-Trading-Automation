"""
Webhook notifier for sending trade alerts to external services (WhatsApp, Discord, etc.)
"""

import aiohttp
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class WebhookNotifier:
    """Sends trade notifications via generic webhook and/or native Telegram."""
    
    def __init__(
        self,
        webhook_url: Optional[str] = None,
        telegram_bot_token: Optional[str] = None,
        telegram_chat_id: Optional[str] = None,
    ):
        self.webhook_url = webhook_url
        self.enabled_webhook = bool(webhook_url)
        self.telegram_bot_token = telegram_bot_token
        self.telegram_chat_id = telegram_chat_id
        self.enabled_telegram = bool(telegram_bot_token and telegram_chat_id)
        
        if self.enabled_webhook:
            logger.info(f"🔔 Webhook notifier enabled: {webhook_url}")
        else:
            logger.info("🔕 Webhook notifier disabled (no WEBHOOK_URL configured)")
        if self.enabled_telegram:
            logger.info("📨 Native Telegram notifier enabled")
        elif telegram_bot_token or telegram_chat_id:
            logger.warning("⚠️ Native Telegram partially configured (need both TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID)")

    @staticmethod
    def _is_telegram_send_message_url(url: str) -> bool:
        lower = (url or "").lower()
        return "api.telegram.org" in lower and "/sendmessage" in lower

    def _format_telegram_message(self, event_type: str, data: Dict[str, Any]) -> str:
        """Create a readable plain-text Telegram message."""
        event = (event_type or "EVENT").upper()
        if event == "ENTRY":
            return (
                f"🟢 ENTRY {data.get('asset', '')}\n"
                f"Side: {data.get('side', '')}\n"
                f"Price: {data.get('price', '')}\n"
                f"Size: {data.get('size', '')}\n"
                f"Leverage: {data.get('leverage', '')}\n"
                f"Reason: {data.get('reason', '')}"
            )
        if event == "EXIT":
            return (
                f"🔴 EXIT {data.get('asset', '')}\n"
                f"Side: {data.get('side', '')}\n"
                f"Entry: {data.get('entry_price', '')}\n"
                f"Exit: {data.get('exit_price', '')}\n"
                f"PnL: {data.get('pnl_percent', '')}% / ${data.get('pnl_usd', '')}\n"
                f"Reason: {data.get('reason', '')}"
            )
        if event == "PAIR_HUNTER":
            pairs = ", ".join(data.get("top_pairs", []) or [])
            positions = ", ".join(data.get("current_positions", []) or [])
            return (
                f"🎯 PAIR HUNTER\n"
                f"Top pairs: {pairs or 'none'}\n"
                f"Open positions: {positions or 'none'}"
            )
        if event == "POSITION_UPDATE":
            return (
                f"📊 POSITION UPDATE\n"
                f"Count: {data.get('count', 0)}\n"
                f"Total PnL: ${data.get('total_pnl_usd', 0)} ({data.get('total_pnl_pct', 0)}%)"
            )
        if event == "DECISION_SUMMARY":
            return (
                f"🧠 DECISION SUMMARY\n"
                f"Assets analyzed: {len(data.get('analyzed_assets', []) or [])}\n"
                f"Action counts: {data.get('action_counts', {})}"
            )
        if event == "MILESTONE":
            return (
                f"🏁 MILESTONE {data.get('asset', '')}\n"
                f"PnL: {data.get('pnl_percent', '')}% / ${data.get('pnl_usd', '')}\n"
                f"{data.get('milestone', '')}"
            )
        if event == "ERROR":
            return (
                f"⚠️ ERROR {data.get('error_type', '')}\n"
                f"Asset: {data.get('asset', '')}\n"
                f"{data.get('message', '')}"
            )
        return f"ℹ️ {event}\n{str(data)}"

    async def _send_webhook_notification(self, event_type: str, data: Dict[str, Any]) -> bool:
        """Send event to generic webhook; if it's Telegram endpoint, send Telegram-compatible payload."""
        if not self.enabled_webhook or not self.webhook_url:
            return False

        try:
            if self._is_telegram_send_message_url(self.webhook_url):
                chat_id = self.telegram_chat_id or data.get("chat_id")
                if not chat_id:
                    logger.warning("⚠️ TELEGRAM_CHAT_ID is missing; cannot send to Telegram sendMessage URL")
                    return False
                payload = {
                    "chat_id": str(chat_id),
                    "text": self._format_telegram_message(event_type, data),
                    "disable_web_page_preview": True,
                }
            else:
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
                    body = await response.text()
                    logger.warning(f"⚠️ Webhook failed: {response.status} for {event_type} - {body[:200]}")
                    return False
        except Exception as e:
            logger.error(f"❌ Webhook error: {e}")
            return False

    async def _send_telegram_notification(self, event_type: str, data: Dict[str, Any]) -> bool:
        """Send event directly to Telegram Bot API using token + chat id."""
        if not self.enabled_telegram:
            return False
        url = f"https://api.telegram.org/bot{self.telegram_bot_token}/sendMessage"
        payload = {
            "chat_id": str(self.telegram_chat_id),
            "text": self._format_telegram_message(event_type, data),
            "disable_web_page_preview": True,
        }
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    url,
                    json=payload,
                    headers={"Content-Type": "application/json"},
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status == 200:
                        logger.debug(f"✅ Telegram sent: {event_type}")
                        return True
                    body = await response.text()
                    logger.warning(f"⚠️ Telegram failed: {response.status} for {event_type} - {body[:200]}")
                    return False
        except Exception as e:
            logger.error(f"❌ Telegram error: {e}")
            return False
    
    async def send_notification(self, event_type: str, data: Dict[str, Any]) -> bool:
        """Send notification to all enabled channels."""
        webhook_ok = await self._send_webhook_notification(event_type, data)
        telegram_ok = await self._send_telegram_notification(event_type, data)
        return webhook_ok or telegram_ok
    
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
    
    async def notify_position_update(self, positions: list, total_pnl_usd: float, total_pnl_pct: float):
        """Notify on periodic position update (P&L summary)"""
        await self.send_notification("POSITION_UPDATE", {
            "positions": positions,
            "total_pnl_usd": total_pnl_usd,
            "total_pnl_pct": total_pnl_pct,
            "count": len(positions),
            "timestamp": str(datetime.now(timezone.utc))
        })
    
    async def notify_profit_milestone(self, asset: str, pnl_percent: float, pnl_usd: float, milestone: str):
        """Notify when hitting profit milestones (e.g., +5%, approaching 7% target)"""
        await self.send_notification("MILESTONE", {
            "asset": asset,
            "pnl_percent": pnl_percent,
            "pnl_usd": pnl_usd,
            "milestone": milestone,
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
