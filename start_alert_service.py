"""Entry point for running the alert service independently."""

import asyncio
import logging
import sys
from pathlib import Path
from dotenv import load_dotenv

# Add project root to path
sys.path.append(str(Path(__file__).parent))

from src.alert_service.alert_monitor import AlertMonitor
from src.config_loader import CONFIG

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('alert_service.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)


async def main():
    """Start the alert service."""
    # Check if alert service is enabled
    if not CONFIG.get("ALERT_SERVICE_ENABLED", False):
        logger.warning("⚠️  Alert service is disabled. Set ALERT_SERVICE_ENABLED=true in .env to enable.")
        return
    
    logger.info("=" * 80)
    logger.info("Alert Service Starting")
    logger.info("=" * 80)
    
    try:
        monitor = AlertMonitor()
        await monitor.run()
    except KeyboardInterrupt:
        logger.info("Alert service stopped by user")
    except Exception as e:
        logger.error(f"Alert service error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nAlert service stopped")
    except Exception as e:
        print(f"Fatal error: {e}")
        sys.exit(1)


