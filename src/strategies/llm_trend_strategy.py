"""LLM-based trend-following strategy (default strategy)."""

import requests
from src.config_loader import CONFIG
from src.indicators.technical_analysis_client import TechnicalAnalysisClient
from src.strategies.strategy_interface import StrategyInterface
import json
import logging
from datetime import datetime
from typing import Dict, Any, List, Union


class LLMTrendStrategy(StrategyInterface):
    """LLM-based trend-following strategy using DeepSeek API.
    
    This is the default strategy that uses an LLM to analyze market conditions
    and make trading decisions based on technical indicators and market context.
    """
    
    def __init__(self):
        """Initialize LLM configuration and technical analysis client."""
        self.model = CONFIG["llm_model"]
        self.api_key = CONFIG["deepseek_api_key"]
        base = CONFIG["deepseek_base_url"]
        self.base_url = f"{base}/chat/completions"
        self.ta_client = TechnicalAnalysisClient()
        # Detect if using reasoner model (has reasoning_content output)
        self.is_reasoner = "reasoner" in self.model.lower()
        # Fast/cheap sanitizer model for parse failures
        self.sanitize_model = CONFIG.get("sanitize_model") or "deepseek-chat"
        self.logger = logging.getLogger(f"strategy.{self.__class__.__name__}")
    
    def decide_trade(self, assets: List[str], context: Union[Dict[str, Any], str]) -> Dict[str, Any]:
        """Generate trading decisions using LLM analysis.
        
        Args:
            assets: List of asset tickers to analyze
            context: Structured market/account state
            
        Returns:
            Dictionary with 'reasoning' and 'trade_decisions' keys
        """
        return self._decide(context, assets=assets)
    
    def _decide(self, context, assets):
        """Dispatch decision request to the LLM and enforce output contract."""
        system_prompt = (
            "You are an AGGRESSIVE QUANTITATIVE TRADER operating like a professional hedge fund algorithm, similar to Alpha Arena agents. "
            "Your mission: ACTIVELY FIND AND EXECUTE TRADING OPPORTUNITIES, not just hold cash.\n\n"
            "You will receive market + account context for SEVERAL assets, including:\n"
            f"- assets = {json.dumps(assets)}\n"
            "- per-asset intraday (5m) and higher-timeframe (4h) metrics\n"
            "- Active Trades with Exit Plans\n"
            "- Recent Trading History\n\n"
            "Always use the 'current time' provided in the user message to evaluate any time-based conditions, such as cooldown expirations or timed exit plans.\n\n"
            "CRITICAL OPERATING PRINCIPLES:\n\n"
            "1. WHEN FLAT (NO POSITIONS): SEEK OPTIMAL ENTRY POINTS (NOT MID-TREND)\n"
            "   - CRITICAL: DO NOT enter just because price is above/below EMAs - wait for MOMENTUM SHIFTS or PULLBACKS\n"
            "   - You MUST actively scan for entry opportunities, but ONLY enter at optimal timing\n"
            "   - DO NOT enter mid-trend when price is already extended - wait for retracements or momentum shifts\n"
            "   - Look for confluence: EMA CROSSOVERS (not just alignment), RSI pullbacks/retracements, MACD crossovers, support/resistance bounces\n"
            "   - PREFERRED ENTRY CONDITIONS:\n"
            "     * EMA CROSSOVER: Fast EMA crosses above/below slow EMA (momentum shift)\n"
            "     * RSI PULLBACK: RSI < 50 for longs (not overbought), RSI > 50 for shorts (not oversold)\n"
            "     * MACD CROSSOVER: MACD crosses above/below signal line (momentum shift)\n"
            "     * PRICE RETRACEMENT: Price pulls back to EMA support/resistance then bounces\n"
            "   - AVOID ENTERING WHEN:\n"
            "     * Price is far above/below EMAs (already extended)\n"
            "     * RSI is neutral (45-55) - no edge, likely mid-trend\n"
            "     * MACD is just positive/negative without crossover (momentum already established)\n"
            "     * No recent pullback or retracement\n"
            "   - Example GOOD entry: RSI < 50 + EMA crossover (fast crosses above slow) + MACD crossover + price bounce from EMA = STRONG BUY\n"
            "   - Example BAD entry: RSI 48 + price above EMA (no crossover) + MACD positive (no crossover) = AVOID (mid-trend)\n"
            "   - Example GOOD entry: RSI > 50 + EMA crossover (fast crosses below slow) + MACD crossover + volume surge = STRONG SELL\n\n"
            "2. WHEN IN POSITIONS: MONITOR EXIT CONDITIONS ACTIVELY\n"
            "   - CRITICAL: If you already have an open position in an asset, you MUST choose 'hold' unless exit conditions are met\n"
            "   - DO NOT suggest 'buy' when you already have a long position - choose 'hold' instead\n"
            "   - DO NOT suggest 'sell' when you already have a short position - choose 'hold' instead\n"
            "   - The system will BLOCK any attempt to add to existing positions in the same direction\n"
            "   - Only suggest 'buy' or 'sell' when you want to CLOSE/FLIP an existing position (opposite direction)\n"
            "   - Check if invalidation conditions in exit_plan have been met\n"
            "   - Monitor TP/SL levels continuously\n"
            "   - CRITICAL: Do NOT exit prematurely - positions need time to develop\n"
            "   - MINIMUM HOLD TIME: Wait at least 15 minutes before considering invalidation-based exits\n"
            "   - MINIMUM PRICE MOVEMENT: Only consider invalidation if price has moved 2%+ against the position\n"
            "   - Exit when invalidation triggers are STRONGLY confirmed (not just minor indicator fluctuations)\n"
            "   - Once a position closes, IMMEDIATELY look for the next opportunity (don't wait)\n\n"
            "3. CYCLE BEHAVIOR (Like Alpha Arena)\n"
            "   - Entry → Monitor → Exit (when conditions met) → Immediate re-scan for new entry → Repeat\n"
            "   - Always be positioned when opportunities exist\n"
            "   - Rotate between assets based on best setups\n\n"
            "Your goal: make decisive, first-principles decisions per asset that ACTIVELY CAPTURE OPPORTUNITIES.\n\n"
            "Aggressively pursue setups where calculated risk is outweighed by expected edge; size positions so downside is controlled while upside remains meaningful.\n\n"
            "Core policy (low-churn, position-aware)\n"
            "1) Respect prior plans: If an active trade has an exit_plan with explicit invalidation (e.g., 'close if 4h close above EMA50'), DO NOT close or flip early unless that invalidation (or a stronger one) has occurred.\n"
            "2) NEVER ADD TO EXISTING POSITIONS: If you already have a position in an asset, you MUST choose 'hold'. DO NOT suggest 'buy' when you have a long position or 'sell' when you have a short position. The system will BLOCK these attempts. Only suggest trades to CLOSE/FLIP existing positions when exit conditions are met.\n"
            "3) Hysteresis: Require stronger evidence to CHANGE a decision than to keep it. Only flip direction if BOTH:\n"
            "   a) Higher-timeframe structure supports the new direction (e.g., 4h EMA20 vs EMA50 and/or MACD regime), AND\n"
            "   b) Intraday structure confirms with a decisive break beyond ~0.5×ATR (recent) and momentum alignment (MACD or RSI slope).\n"
            "   Otherwise, prefer HOLD or adjust TP/SL.\n"
            "4) Cooldown & Minimum Hold Time: After opening or flipping a position, impose a self-cooldown of at least 3 bars of the decision timeframe (e.g., 3×5m = 15m) before another direction change. CRITICAL: The system will BLOCK premature exits (less than 15 minutes) unless price has moved 2%+ against the position. Do NOT suggest closing positions that are less than 15 minutes old unless there's a STRONG invalidation (5%+ adverse move). Encode this in exit_plan (e.g., 'cooldown_bars:3 until 2025-10-19T15:55Z'). You must honor your own cooldowns on future cycles.\n"
            "5) Funding is a tilt, not a trigger: Do NOT open/close/flip solely due to funding unless expected funding over your intended holding horizon meaningfully exceeds expected edge (e.g., > ~0.25×ATR). Consider that funding accrues discretely and slowly relative to 5m bars.\n"
            "6) Overbought/oversold ≠ reversal by itself: Treat RSI extremes as risk-of-pullback. You need structure + momentum confirmation to bet against trend. Prefer tightening stops or taking partial profits over instant flips.\n"
            "7) Prefer adjustments over exits: If the thesis weakens but is not invalidated, first consider: tighten stop (e.g., to a recent swing or ATR multiple), trail TP, or reduce size. Flip only on hard invalidation + fresh confluence.\n\n"
            "Decision discipline (per asset) - ACTIVE TRADING FOCUS\n"
            "- Choose one: buy / sell / hold.\n"
            "- CRITICAL: If you have NO position in an asset, you MUST actively analyze for entry signals. Only choose 'hold' if you've checked and found NO viable setup.\n"
            "- CRITICAL: If you ALREADY have a position in an asset:\n"
            "  * If you have a LONG position: Choose 'hold' (unless exit conditions met, then 'sell' to close)\n"
            "  * If you have a SHORT position: Choose 'hold' (unless exit conditions met, then 'buy' to close)\n"
            "  * NEVER choose 'buy' when you already have a long position - this will be blocked\n"
            "  * NEVER choose 'sell' when you already have a short position - this will be blocked\n"
            "  * Only suggest 'buy' or 'sell' when you want to CLOSE/FLIP the existing position\n"
            "- For positions: Only 'hold' if invalidation conditions haven't been met. To close, use opposite action (sell for long, buy for short).\n"
            "- Proactively harvest profits when price action presents clear opportunities or invalidation triggers.\n"
            "- POSITION SIZING (CRITICAL - CHECK trading_settings.note FOR MODE):\n"
            "  • IMPORTANT: Check the 'trading_settings.note' field in the context - it will tell you:\n"
            "    - If position_sizing_mode is 'margin': You do NOT need to calculate allocation_usd - system handles it automatically\n"
            "    - If position_sizing_mode is 'auto' or 'target_profit': YOU must calculate allocation_usd with minimums:\n"
            "      * If 1-2 positions active: MINIMUM $50\n"
            "      * If 3+ positions active: MINIMUM $25\n"
            "      * Base formula: MINIMUM = $25.00 / (0.015 * leverage)\n"
            "      * Example: With 10x leverage → Base MINIMUM = $25.00 / (0.015 * 10) = $25.00 / 0.15 = $66.67\n"
            "      * But actual minimum is: $50 if 1-2 positions, $25 if 3+ positions\n"
            "      * You can use MORE than the minimum to maximize profits, but NEVER less\n"
            "      * Calculate: allocation_usd = max(minimum_required, your_preferred_amount)\n"
            "  • The system will validate your allocation and warn if it's too low\n"
            "  • ALWAYS respect max_positions limit - don't open more positions than allowed\n"
            "  • ALWAYS follow the instructions in trading_settings.note - it overrides these default rules\n"
            "- TP/SL sanity - SMART PROFIT-TAKING (Don't be greedy!):\n"
            "  • IMPORTANT: Consider fees (~0.08% round trip). Taking 5-10% profit and re-entering is often better than holding for 40%+\n"
            "  • BUY: tp_price > current_price. Set REALISTIC targets: 5-10% for most trades, max 20% for strong trends\n"
            "    - For volatile assets: 8-12% TP (fees eat into small gains)\n"
            "    - For stable assets: 10-15% TP\n"
            "    - Only use 20%+ TP if strong trend continuation signal\n"
            "  • SELL: tp_price < current_price (same percentages apply)\n"
            "  • sl_price: 5-10% for most trades, max 15% unless high volatility\n"
            "  • Always set TP/SL based on technical levels (support/resistance) or ATR multiples\n"
            "  • CRITICAL: If a position is up 10%+ and TP is still far away (>20%), the system will auto-take profit. Set reasonable TPs!\n"
            "- exit_plan MUST include:\n"
            "  • At least ONE explicit invalidation trigger (e.g., 'If price closes below [level]', 'If MACD crosses below signal', 'If RSI rises above 70')\n"
            "  • Profit target rationale\n"
            "  • Risk management rationale\n"
            "  • This will be monitored on every cycle\n\n"
            "Leverage policy (perpetual futures)\n"
            "- YOU CAN USE LEVERAGE, ATLEAST 3X LEVERAGE TO GET BETTER RETURN, KEEP IT WITHIN 10X IN TOTAL\n"
            "- In high volatility (elevated ATR) or during funding spikes, reduce or avoid leverage.\n"
            "- Treat allocation_usd as notional exposure; keep it consistent with safe leverage and available margin.\n\n"
            "Tool usage\n"
            "- Aggressively leverage fetch_technical_indicator whenever an additional datapoint could sharpen your thesis; keep parameters minimal (indicator, symbol like \"BTC/USDT\", interval \"5m\"/\"4h\", optional period).\n"
            "- Incorporate tool findings into your reasoning, but NEVER paste raw tool responses into the final JSON—summarize the insight instead.\n"
            "- Use tools to upgrade your analysis; lack of confidence is a cue to query them before deciding.\n\n"
            "Reasoning recipe (first principles) - OPTIMAL ENTRY TIMING\n"
            "- Structure (trend, EMAs slope/cross, HH/HL vs LH/LL), Momentum (MACD regime, RSI slope), Liquidity/volatility (ATR, volume), Positioning tilt (funding, OI).\n"
            "- Favor alignment across 4h and 5m. Counter-trend scalps require stronger intraday confirmation and tighter risk.\n"
            "- CRITICAL: Before analyzing entry signals, FIRST check if you already have a position in this asset. If you do, skip entry analysis and focus on exit conditions only.\n"
            "- ENTRY TIMING PHILOSOPHY: Wait for the RIGHT moment, not just ANY moment\n"
            "  * Don't enter just because a trend exists - wait for momentum shifts (crossovers) or pullbacks\n"
            "  * Better to miss a trade than enter at a bad price (mid-trend entries often get stopped out)\n"
            "  * Look for recent price action: Has price pulled back? Has there been a crossover? Is RSI showing a retracement?\n"
            "  * If all indicators just say 'trend is up' without showing a recent shift or pullback → WAIT\n"
            "- ENTRY SIGNAL CHECKLIST (ONLY when FLAT - no existing position):\n"
            "  CRITICAL: Prefer MOMENTUM SHIFTS and PULLBACKS over mid-trend entries\n\n"
            "  REQUIRED for STRONG signals (need at least 2 of these):\n"
            "  ✓ EMA CROSSOVER: Fast EMA crosses above/below slow EMA (momentum shift, not just alignment)\n"
            "  ✓ RSI PULLBACK/RETRACEMENT: RSI < 50 for longs (recent pullback), RSI > 50 for shorts (recent bounce)\n"
            "     - RSI < 30 = oversold (strong buy opportunity)\n"
            "     - RSI > 70 = overbought (strong sell opportunity)\n"
            "     - RSI 45-55 = AVOID (neutral, likely mid-trend, no edge)\n"
            "  ✓ MACD CROSSOVER: MACD crosses above/below signal line (momentum shift, not just positive/negative)\n"
            "  ✓ PRICE RETRACEMENT: Price pulled back to EMA support/resistance then bounced (not extended)\n"
            "\n"
            "  SUPPORTING signals (adds confidence):\n"
            "  ✓ Volume confirmation (unusual volume on breaks/crossovers)\n"
            "  ✓ Support/Resistance levels (price bouncing off key levels)\n"
            "  ✓ ATR for stop placement (use 1.5-2x ATR for stops)\n"
            "\n"
            "  ENTRY TIMING RULES:\n"
            "  - STRONG SIGNAL (3+ required signals): Enter immediately\n"
            "  - MODERATE SIGNAL (2 required signals): Enter if price is NOT extended (within 1-2% of EMA)\n"
            "  - WEAK SIGNAL (1 required signal): DO NOT ENTER - wait for better setup\n"
            "  - NO SIGNAL: Hold and wait for pullback/retracement or momentum shift\n"
            "\n"
            "  AVOID ENTERING WHEN:\n"
            "  - Price is >2% above/below EMA (extended, likely to pullback)\n"
            "  - RSI is 45-55 (neutral, mid-trend, no edge)\n"
            "  - MACD is just positive/negative without crossover (momentum already established)\n"
            "  - No recent pullback or retracement visible\n"
            "  - All indicators just show 'trend exists' without momentum shift\n\n"
            "Output contract\n"
            "- Output a STRICT JSON object with exactly two properties:\n"
            "  • reasoning: long-form string capturing detailed, step-by-step analysis that means you can acknowledge existing information as clarity, or acknowledge that you need more information to make a decision (be verbose).\n"
            "  • trade_decisions: array ordered to match the provided assets list.\n"
            "- Each item inside trade_decisions must contain the keys {asset, action, allocation_usd, tp_price, sl_price, exit_plan, rationale}.\n"
            "- CRITICAL DECISION LOGIC:\n"
            "  • For each asset, FIRST check if you have an existing position (from 'active_trades' or 'account.positions' in context)\n"
            "  • If you have a LONG position: action MUST be 'hold' (unless exit conditions met, then 'sell')\n"
            "  • If you have a SHORT position: action MUST be 'hold' (unless exit conditions met, then 'buy')\n"
            "  • If you have NO position: analyze entry signals and choose 'buy', 'sell', or 'hold'\n"
            "  • NEVER choose 'buy' when you have a long position or 'sell' when you have a short position\n"
            "- CRITICAL: Return ONLY valid JSON. Do not wrap in markdown code blocks. Do not add explanations outside the JSON object. Start with { and end with }.\n"
        )
        user_prompt = context
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        tools = [{
            "type": "function",
            "function": {
                "name": "fetch_technical_indicator",
                "description": ("Fetch technical indicators using TA-Lib (via pandas-ta) and Binance market data. "
                    "Available indicators: ema, sma, rsi, macd, bbands, atr. Market data is fetched from Binance public API. "
                    "No rate limits apply as we use local calculations with free Binance data. "
                    "Supported: ema, sma, rsi, macd, bbands, atr with customizable periods."),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "indicator": {"type": "string"},
                        "symbol": {"type": "string"},
                        "interval": {"type": "string"},
                        "period": {"type": "integer"},
                        "backtrack": {"type": "integer"},
                        "other_params": {"type": "object", "additionalProperties": {"type": ["string", "number", "boolean"]}},
                    },
                    "required": ["indicator", "symbol", "interval"],
                    "additionalProperties": False,
                },
            },
        }]

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        def _post(payload, max_retries=3, backoff=2.0):
            """Send a POST request to DeepSeek API with retry logic for connection errors."""
            import time
            
            logging.info("Sending request to DeepSeek API (model: %s)", payload.get('model'))
            prompt_size = len(json.dumps(payload))
            logging.info(f"Request size: {prompt_size:,} bytes ({prompt_size/1024:.1f} KB)")
            
            with open("llm_requests.log", "a", encoding="utf-8") as f:
                f.write(f"\n\n=== {datetime.now()} ===\n")
                f.write(f"Model: {payload.get('model')}\n")
                f.write(f"Request size: {prompt_size:,} bytes\n")
                f.write(f"Headers: {json.dumps({k: v for k, v in headers.items() if k != 'Authorization'})}\n")
                f.write(f"Payload:\n{json.dumps(payload, indent=2)}\n")
            
            last_error = None
            for attempt in range(max_retries):
                try:
                    timeout = 120 + (prompt_size // 10240)
                    resp = requests.post(self.base_url, headers=headers, json=payload, timeout=timeout)
                    logging.info("Received response from DeepSeek API (status: %s)", resp.status_code)
                    if resp.status_code != 200:
                        logging.error("DeepSeek API error: %s - %s", resp.status_code, resp.text)
                        with open("llm_requests.log", "a", encoding="utf-8") as f:
                            f.write(f"ERROR Response: {resp.status_code} - {resp.text}\n")
                    resp.raise_for_status()
                    return resp.json()
                except (requests.exceptions.ConnectionError, requests.exceptions.Timeout, 
                        requests.exceptions.ChunkedEncodingError, OSError) as e:
                    last_error = e
                    error_type = type(e).__name__
                    if attempt < max_retries - 1:
                        wait_time = backoff * (2 ** attempt)
                        logging.warning(f"Connection error ({error_type}) on attempt {attempt + 1}/{max_retries}: {e}. Retrying in {wait_time}s...")
                        time.sleep(wait_time)
                        continue
                    else:
                        logging.error(f"Connection error ({error_type}) after {max_retries} attempts: {e}")
                        with open("llm_requests.log", "a", encoding="utf-8") as f:
                            f.write(f"CONNECTION ERROR after {max_retries} attempts: {error_type} - {str(e)}\n")
                        raise
                except requests.HTTPError:
                    raise
            
            if last_error:
                raise last_error
            raise RuntimeError("Failed to send request after retries")

        def _sanitize_output(raw_content: str, assets_list):
            """Coerce arbitrary LLM output into the required reasoning + decisions schema."""
            try:
                schema = {
                    "type": "object",
                    "properties": {
                        "reasoning": {"type": "string"},
                        "trade_decisions": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "asset": {"type": "string", "enum": assets_list},
                                    "action": {"type": "string", "enum": ["buy", "sell", "hold"]},
                                    "allocation_usd": {"type": "number"},
                                    "tp_price": {"type": ["number", "null"]},
                                    "sl_price": {"type": ["number", "null"]},
                                    "exit_plan": {"type": "string"},
                                    "rationale": {"type": "string"},
                                },
                                "required": ["asset", "action", "allocation_usd", "tp_price", "sl_price", "exit_plan", "rationale"],
                                "additionalProperties": False,
                            },
                            "minItems": 1,
                        }
                    },
                    "required": ["reasoning", "trade_decisions"],
                    "additionalProperties": False,
                }
                payload = {
                    "model": self.sanitize_model,
                    "messages": [
                        {"role": "system", "content": (
                            "You are a strict JSON normalizer. Return ONLY a JSON array matching the provided JSON Schema. "
                            "If input is wrapped or has prose/markdown, fix it. Do not add fields."
                        )},
                        {"role": "user", "content": raw_content},
                    ],
                    "response_format": {
                        "type": "json_schema",
                        "json_schema": {
                            "name": "trade_decisions",
                            "strict": True,
                            "schema": schema,
                        },
                    },
                    "temperature": 0,
                }
                resp = _post(payload)
                msg = resp.get("choices", [{}])[0].get("message", {})
                parsed = msg.get("parsed")
                if isinstance(parsed, dict):
                    if "trade_decisions" in parsed:
                        return parsed
                content = msg.get("content") or "[]"
                try:
                    loaded = json.loads(content)
                    if isinstance(loaded, dict) and "trade_decisions" in loaded:
                        return loaded
                except (json.JSONDecodeError, KeyError, ValueError, TypeError):
                    pass
                return {"reasoning": "", "trade_decisions": []}
            except (requests.RequestException, json.JSONDecodeError, KeyError, ValueError, TypeError) as se:
                logging.error("Sanitize failed: %s", se)
                return {"reasoning": "", "trade_decisions": []}

        allow_tools = True
        allow_structured = True

        def _build_schema():
            """Assemble the JSON schema used for structured LLM responses."""
            base_properties = {
                "asset": {"type": "string", "enum": assets},
                "action": {"type": "string", "enum": ["buy", "sell", "hold"]},
                "allocation_usd": {"type": "number", "minimum": 0},
                "tp_price": {"type": ["number", "null"]},
                "sl_price": {"type": ["number", "null"]},
                "exit_plan": {"type": "string"},
                "rationale": {"type": "string"},
            }
            required_keys = ["asset", "action", "allocation_usd", "tp_price", "sl_price", "exit_plan", "rationale"]
            return {
                "type": "object",
                "properties": {
                    "reasoning": {"type": "string"},
                    "trade_decisions": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": base_properties,
                            "required": required_keys,
                            "additionalProperties": False,
                        },
                        "minItems": 1,
                    }
                },
                "required": ["reasoning", "trade_decisions"],
                "additionalProperties": False,
            }

        for _ in range(6):
            data = {"model": self.model, "messages": messages}
            
            if self.is_reasoner:
                allow_tools = False
                allow_structured = False
            else:
                if allow_structured:
                    data["response_format"] = {"type": "json_object"}
                if allow_tools:
                    data["tools"] = tools
                    data["tool_choice"] = "auto"
            
            if self.is_reasoner:
                data["max_tokens"] = CONFIG.get("deepseek_max_tokens") or 64000
            
            try:
                resp_json = _post(data)
            except requests.HTTPError as e:
                try:
                    err = e.response.json()
                except (json.JSONDecodeError, ValueError, AttributeError):
                    err = {}
                err_text = json.dumps(err)
                
                if allow_structured and ("response_format" in err_text or "structured" in err_text or e.response.status_code in (400, 422)):
                    logging.warning("DeepSeek rejected structured outputs; retrying without response_format.")
                    allow_structured = False
                    continue
                if allow_tools and ("tools" in err_text or "function" in err_text or e.response.status_code in (400, 422)):
                    logging.warning("DeepSeek rejected tools; retrying without tools.")
                    allow_tools = False
                    continue
                raise

            choice = resp_json["choices"][0]
            message = choice["message"]
            
            if self.is_reasoner and "reasoning_content" in message:
                reasoning_content = message.get("reasoning_content")
                if reasoning_content:
                    logging.info("Reasoner CoT (first 200 chars): %s", str(reasoning_content)[:200])
            
            message_for_history = {k: v for k, v in message.items() if k != "reasoning_content"}
            messages.append(message_for_history)

            tool_calls = message.get("tool_calls") or []
            if allow_tools and tool_calls:
                for tc in tool_calls:
                    if tc.get("type") == "function" and tc.get("function", {}).get("name") == "fetch_technical_indicator":
                        args = json.loads(tc["function"].get("arguments") or "{}")
                        try:
                            indicator = args.get("indicator", "").lower()
                            symbol = args.get("symbol", "")
                            interval = args.get("interval", "")
                            period = args.get("period")
                            backtrack = args.get("backtrack", 0)
                            
                            params = {}
                            if period is not None:
                                params["period"] = period
                            if isinstance(args.get("other_params"), dict):
                                params.update(args["other_params"])
                            
                            needs_series = backtrack is not None and backtrack > 0
                            
                            if needs_series:
                                results = max(backtrack + 1, 10)
                                series = self.ta_client.fetch_series(indicator, symbol, interval, results=results, params=params if params else None)
                                ind_resp = {"value": series} if indicator != "macd" else {"valueMACD": series}
                            else:
                                value_key = "value"
                                if indicator == "macd":
                                    value_key = "valueMACD"
                                
                                value = self.ta_client.fetch_value(indicator, symbol, interval, params=params if params else None, key=value_key)
                                if indicator == "macd":
                                    historical = self.ta_client.get_historical_indicator(indicator, symbol, interval, results=1, params=params if params else None)
                                    ind_resp = historical[0] if historical and len(historical) > 0 else {"valueMACD": value, "valueMACDSignal": None, "valueMACDHist": None}
                                else:
                                    ind_resp = {"value": value}
                            
                            messages.append({
                                "role": "tool",
                                "tool_call_id": tc.get("id"),
                                "name": "fetch_technical_indicator",
                                "content": json.dumps(ind_resp),
                            })
                        except (KeyError, ValueError, AttributeError, Exception) as ex:
                            messages.append({
                                "role": "tool",
                                "tool_call_id": tc.get("id"),
                                "name": "fetch_technical_indicator",
                                "content": f"Error: {str(ex)}",
                            })
                continue

            try:
                content = message.get("content") or "{}"
                
                reasoning_text = ""
                if self.is_reasoner:
                    reasoning_content = message.get("reasoning_content")
                    if reasoning_content:
                        reasoning_text = str(reasoning_content)
                        logging.info("Extracted reasoning_content from reasoner model")
                
                if isinstance(message.get("parsed"), dict):
                    parsed = message.get("parsed")
                else:
                    parsed = json.loads(content)

                if not isinstance(parsed, dict):
                    logging.error("Expected dict payload, got: %s; attempting sanitize", type(parsed))
                    sanitized = _sanitize_output(content, assets)
                    if sanitized.get("trade_decisions"):
                        return sanitized
                    return {"reasoning": reasoning_text, "trade_decisions": []}

                if not reasoning_text:
                    reasoning_text = parsed.get("reasoning", "") or ""
                decisions = parsed.get("trade_decisions")

                if isinstance(decisions, list):
                    normalized = []
                    for item in decisions:
                        if isinstance(item, dict):
                            item.setdefault("allocation_usd", 0.0)
                            item.setdefault("tp_price", None)
                            item.setdefault("sl_price", None)
                            item.setdefault("exit_plan", "")
                            item.setdefault("rationale", "")
                            normalized.append(item)
                        elif isinstance(item, list) and len(item) >= 7:
                            normalized.append({
                                "asset": item[0],
                                "action": item[1],
                                "allocation_usd": float(item[2]) if item[2] else 0.0,
                                "tp_price": float(item[3]) if item[3] and item[3] != "null" else None,
                                "sl_price": float(item[4]) if item[4] and item[4] != "null" else None,
                                "exit_plan": item[5] if len(item) > 5 else "",
                                "rationale": item[6] if len(item) > 6 else ""
                            })
                    return {"reasoning": reasoning_text, "trade_decisions": normalized}

                logging.error("trade_decisions missing or invalid; attempting sanitize")
                sanitized = _sanitize_output(content if 'content' in locals() else json.dumps(parsed), assets)
                if sanitized.get("trade_decisions"):
                    return sanitized
                return {"reasoning": reasoning_text, "trade_decisions": []}
            except (json.JSONDecodeError, KeyError, ValueError, TypeError) as e:
                logging.error("JSON parse error: %s, content: %s", e, content[:200])
                sanitized = _sanitize_output(content, assets)
                if sanitized.get("trade_decisions"):
                    return sanitized
                return {
                    "reasoning": "Parse error",
                    "trade_decisions": [{
                        "asset": a,
                        "action": "hold",
                        "allocation_usd": 0.0,
                        "tp_price": None,
                        "sl_price": None,
                        "exit_plan": "",
                        "rationale": "Parse error"
                    } for a in assets]
                }

        return {
            "reasoning": "tool loop cap",
            "trade_decisions": [{
                "asset": a,
                "action": "hold",
                "allocation_usd": 0.0,
                "tp_price": None,
                "sl_price": None,
                "exit_plan": "",
                "rationale": "tool loop cap"
            } for a in assets]
        }

