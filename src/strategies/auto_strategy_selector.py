"""Auto strategy selector that uses LLM to choose the best strategy based on market conditions."""

from src.strategies.strategy_interface import StrategyInterface
from src.config_loader import CONFIG
from src.indicators.technical_analysis_client import TechnicalAnalysisClient
import requests
import json
import logging
from typing import Dict, Any, List, Optional, Union
from datetime import datetime, timezone, timedelta


class AutoStrategySelector(StrategyInterface):
    """Automatically selects the best strategy based on market conditions using LLM analysis.
    
    Features:
    - Analyzes market conditions (volatility, trend, volume, regime)
    - Uses LLM to recommend optimal strategy
    - Caches strategy selection (15-30 min cooldown)
    - Falls back to default strategy if LLM fails
    """
    
    def __init__(self):
        """Initialize auto strategy selector."""
        self.ta_client = TechnicalAnalysisClient()
        self.logger = logging.getLogger(f"strategy.{self.__class__.__name__}")
        
        # LLM configuration
        self.model = CONFIG["llm_model"]
        self.api_key = CONFIG["deepseek_api_key"]
        base = CONFIG["deepseek_base_url"]
        self.base_url = f"{base}/chat/completions"
        
        # Strategy selection cache
        self.selected_strategy: Optional[StrategyInterface] = None
        self.selection_timestamp: Optional[datetime] = None
        self.selection_reasoning: str = ""
        self.cache_duration_minutes = 20  # Cache strategy selection for 20 minutes
        
        # Fallback to default strategy (lazy import to avoid circular dependency)
        self.default_strategy = None
    
    def decide_trade(self, assets: List[str], context: Union[Dict[str, Any], str]) -> Dict[str, Any]:
        """Generate trading decisions by delegating to selected strategy.
        
        Args:
            assets: List of asset tickers to analyze
            context: Structured market/account state
            
        Returns:
            Dictionary with 'reasoning' and 'trade_decisions' keys
        """
        # Check if we need to re-select strategy
        strategy = self._get_or_select_strategy(assets, context)
        
        # Delegate to selected strategy
        result = strategy.decide_trade(assets, context)
        
        # Add auto selection info to reasoning (only on first selection or when strategy changes)
        if self.selection_reasoning and (not hasattr(self, '_last_reasoning') or self._last_reasoning != self.selection_reasoning):
            result["reasoning"] = f"🤖 [Auto Mode] Selected Strategy: {strategy.get_name()}\n📝 Selection Reasoning: {self.selection_reasoning}\n\n{result.get('reasoning', '')}"
            self._last_reasoning = self.selection_reasoning
        
        return result
    
    def _get_or_select_strategy(self, assets: List[str], context: Dict[str, Any]) -> StrategyInterface:
        """Get cached strategy or select new one if cache expired."""
        # Check if cache is still valid
        if (self.selected_strategy is not None and 
            self.selection_timestamp is not None and
            datetime.now(timezone.utc) - self.selection_timestamp < timedelta(minutes=self.cache_duration_minutes)):
            # Log current strategy being used (every time, but less verbose)
            if hasattr(self, '_last_logged_strategy') and self._last_logged_strategy == self.selected_strategy.get_name():
                return self.selected_strategy
            self.logger.info(f"📊 Auto Mode: Currently using strategy '{self.selected_strategy.get_name()}' (cached, expires in {self.cache_duration_minutes} min)")
            self._last_logged_strategy = self.selected_strategy.get_name()
            return self.selected_strategy
        
        # Need to select new strategy
        self.logger.info("🔄 Strategy cache expired or missing, analyzing market conditions to select best strategy...")
        strategy = self._select_strategy(assets, context)
        
        # Cache the selection
        self.selected_strategy = strategy
        self.selection_timestamp = datetime.now(timezone.utc)
        self._last_logged_strategy = strategy.get_name()
        
        return strategy
    
    def _select_strategy(self, assets: List[str], context: Dict[str, Any]) -> StrategyInterface:
        """Use LLM to analyze market and select best strategy."""
        # Lazy import to avoid circular dependency
        from src.strategies.strategy_factory import StrategyFactory
        
        # Initialize default strategy if not already done
        if self.default_strategy is None:
            self.default_strategy = StrategyFactory.get_strategy("default")
        
        try:
            # Analyze market conditions
            market_analysis = self._analyze_market_conditions(assets, context)
            
            # Call LLM to recommend strategy
            recommended_strategy = self._llm_recommend_strategy(market_analysis, assets)
            
            if recommended_strategy:
                try:
                    strategy = StrategyFactory.get_strategy(recommended_strategy)
                    self.logger.info(f"✅ Auto Mode: LLM selected strategy '{recommended_strategy}'")
                    self.logger.info(f"   Reasoning: {self.selection_reasoning}")
                    return strategy
                except ValueError:
                    self.logger.warning(f"LLM recommended unknown strategy: {recommended_strategy}, using default")
                    return self.default_strategy
            else:
                self.logger.warning("LLM did not return strategy recommendation, using default")
                return self.default_strategy
                
        except Exception as e:
            self.logger.error(f"Error in strategy selection: {e}")
            return self.default_strategy
    
    def _analyze_market_conditions(self, assets: List[str], context: Union[Dict[str, Any], str]) -> Dict[str, Any]:
        """Analyze current market conditions for strategy selection."""
        # Parse context if it's a string
        if isinstance(context, str):
            try:
                context = json.loads(context)
            except (json.JSONDecodeError, TypeError) as e:
                self.logger.error(f"Error parsing context in market analysis: {e}")
                return {"assets": assets, "market_conditions": {}}
        
        analysis = {
            "assets": assets,
            "market_conditions": {}
        }
        
        # Get market data - it's a list of dicts, convert to dict keyed by asset
        market_data_list = context.get("market_data", [])
        market_data = {}
        if isinstance(market_data_list, list):
            for item in market_data_list:
                if isinstance(item, dict) and "asset" in item:
                    market_data[item["asset"]] = item
        elif isinstance(market_data_list, dict):
            market_data = market_data_list
        
        # Analyze each asset
        for asset in assets[:3]:  # Analyze first 3 assets as sample
            try:
                symbol = f"{asset}/USDT"
                asset_data = market_data.get(asset, {})
                
                # Get volatility (ATR)
                atr_5m = self.ta_client.fetch_value("atr", symbol, "5m", {"period": 14})
                atr_4h = self.ta_client.fetch_value("atr", symbol, "4h", {"period": 14})
                
                # Get trend indicators
                ema20_5m = self.ta_client.fetch_value("ema", symbol, "5m", {"period": 20})
                ema50_4h = self.ta_client.fetch_value("ema", symbol, "4h", {"period": 50})
                current_price = asset_data.get("current_price")
                
                # Get RSI
                rsi_5m = self.ta_client.fetch_value("rsi", symbol, "5m", {"period": 14})
                rsi_4h = self.ta_client.fetch_value("rsi", symbol, "4h", {"period": 14})
                
                # Get volume (simplified)
                volume_ok = True  # Assume volume is adequate if we got other indicators
                
                analysis["market_conditions"][asset] = {
                    "volatility_5m": atr_5m,
                    "volatility_4h": atr_4h,
                    "trend_5m": "bullish" if current_price and ema20_5m and current_price > ema20_5m else "bearish" if current_price and ema20_5m else "neutral",
                    "trend_4h": "bullish" if current_price and ema50_4h and current_price > ema50_4h else "bearish" if current_price and ema50_4h else "neutral",
                    "rsi_5m": rsi_5m,
                    "rsi_4h": rsi_4h,
                    "volume_ok": volume_ok
                }
            except Exception as e:
                self.logger.error(f"Error analyzing {asset}: {e}")
                continue
        
        return analysis
    
    def _llm_recommend_strategy(self, market_analysis: Dict[str, Any], assets: List[str]) -> Optional[str]:
        """Use LLM to recommend the best strategy based on market analysis."""
        try:
            system_prompt = (
                "You are a trading strategy selector. Your job is to analyze market conditions and recommend "
                "the best trading strategy from the available options.\n\n"
                "Available strategies:\n"
                "1. 'scalping' - 5-minute scalping strategy with EMA crossovers, RSI filters, and volume surge detection. "
                "   Best for: High volatility, ranging markets, quick entries/exits\n"
                "2. 'llm_trend' (or 'default') - LLM-based trend-following strategy with multi-timeframe analysis. "
                "   Best for: Trending markets, strong directional moves, when you need adaptive analysis\n\n"
                "Analyze the provided market conditions and recommend ONE strategy.\n\n"
                "Return ONLY a JSON object with this exact format:\n"
                "{\n"
                '  "recommended_strategy": "scalping" or "llm_trend",\n'
                '  "reasoning": "Brief explanation of why this strategy is best for current conditions"\n'
                "}\n\n"
                "Consider:\n"
                "- Volatility: High volatility favors scalping\n"
                "- Trend strength: Strong trends favor llm_trend\n"
                "- Market regime: Ranging markets favor scalping, trending markets favor llm_trend\n"
                "- Timeframe: 5m focus favors scalping, multi-timeframe favors llm_trend"
            )
            
            user_prompt = json.dumps({
                "market_analysis": market_analysis,
                "assets": assets
            }, indent=2)
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            }
            
            payload = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "temperature": 0.3,  # Lower temperature for more consistent recommendations
            }
            
            # Add response format if supported
            if "reasoner" not in self.model.lower():
                payload["response_format"] = {"type": "json_object"}
            
            resp = requests.post(self.base_url, headers=headers, json=payload, timeout=60)
            resp.raise_for_status()
            resp_json = resp.json()
            
            message = resp_json["choices"][0]["message"]
            content = message.get("content") or "{}"
            
            # Parse response
            try:
                parsed = json.loads(content)
                recommended = parsed.get("recommended_strategy", "").lower()
                reasoning = parsed.get("reasoning", "No reasoning provided")
                
                self.selection_reasoning = reasoning
                
                # Validate recommendation
                if recommended in ["scalping", "llm_trend", "default"]:
                    return recommended if recommended != "default" else "llm_trend"
                else:
                    self.logger.warning(f"LLM returned invalid strategy: {recommended}")
                    return None
            except (json.JSONDecodeError, KeyError) as e:
                self.logger.error(f"Error parsing LLM response: {e}, content: {content[:200]}")
                return None
                
        except Exception as e:
            self.logger.error(f"Error calling LLM for strategy selection: {e}")
            return None
    
    def get_name(self) -> str:
        """Get the strategy name."""
        if self.selected_strategy:
            return f"AutoSelector({self.selected_strategy.get_name()})"
        return "AutoSelector(selecting...)"

