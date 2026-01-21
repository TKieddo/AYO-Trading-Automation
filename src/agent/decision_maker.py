"""Decision-making agent that orchestrates LLM prompts and indicator lookups."""

import requests
from src.config_loader import CONFIG
from src.indicators.technical_analysis_client import TechnicalAnalysisClient
import json
import logging
from datetime import datetime

class TradingAgent:
    """High-level trading agent that delegates reasoning to an LLM service."""

    def __init__(self):
        """Initialize LLM configuration, metadata headers, and indicator helper."""
        self.model = CONFIG["llm_model"]
        self.api_key = CONFIG["deepseek_api_key"]
        base = CONFIG["deepseek_base_url"]
        self.base_url = f"{base}/chat/completions"
        self.ta_client = TechnicalAnalysisClient()
        # Detect if using reasoner model (has reasoning_content output)
        self.is_reasoner = "reasoner" in self.model.lower()
        # Fast/cheap sanitizer model for parse failures (use deepseek-chat for normalization)
        self.sanitize_model = CONFIG.get("sanitize_model") or "deepseek-chat"

    def decide_trade(self, assets, context):
        """Decide for multiple assets in one call.

        Args:
            assets: Iterable of asset tickers to score.
            context: Structured market/account state forwarded to the LLM.

        Returns:
            List of trade decision payloads, one per asset.
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
            "1. WHEN FLAT (NO POSITIONS): AGGRESSIVELY SEEK ENTRIES\n"
            "   - You MUST actively scan for entry opportunities using technical analysis\n"
            "   - Look for confluence: EMA crossovers, RSI extremes with confirmation, MACD signals, support/resistance breaks\n"
            "   - DO NOT just say 'hold' when you have no positions - FIND TRADES\n"
            "   - Use indicators to identify oversold/overbought conditions with structural support\n"
            "   - Example: RSI < 30 + price above EMA20 on 4h + MACD turning positive = STRONG BUY signal\n"
            "   - Example: RSI > 70 + price below EMA20 on 4h + increasing volume = STRONG SELL signal\n\n"
            "2. WHEN IN POSITIONS: MONITOR EXIT CONDITIONS ACTIVELY\n"
            "   - CRITICAL: If you already have an open position in an asset, you MUST choose 'hold' unless exit conditions are met\n"
            "   - DO NOT suggest 'buy' when you already have a long position - choose 'hold' instead\n"
            "   - DO NOT suggest 'sell' when you already have a short position - choose 'hold' instead\n"
            "   - The system will BLOCK any attempt to add to existing positions in the same direction\n"
            "   - Only suggest 'buy' or 'sell' when you want to CLOSE/FLIP an existing position (opposite direction)\n"
            "   - Check if invalidation conditions in exit_plan have been met\n"
            "   - Monitor TP/SL levels continuously\n"
            "   - When exit conditions are met (TP, SL, invalidation, reversal signals), close IMMEDIATELY\n"
            "   - No hold time restrictions - if technical data supports exit, execute immediately\n"
            "   - Exit when invalidation triggers are confirmed (MACD crossover, EMA breaks, etc.)\n"
            "   - Once a position closes, IMMEDIATELY look for the next opportunity (don't wait)\n\n"
            "   🚨 DUAL PROTECTION SYSTEM (AI + SYSTEM BACKUP) 🚨\n"
            "   You SHOULD actively suggest closes when conditions are met. The system ALSO monitors as backup:\n"
            "   - TRAILING STOP LOSS: When position reaches 5%+ profit, system automatically moves SL up\n"
            "     * YOU SHOULD suggest closing if profit is high and showing reversal signs\n"
            "     * System ALSO automatically trails SL as backup protection\n"
            "   - MAXIMUM HOLD TIME: All positions automatically close after 24 hours\n"
            "     * YOU SHOULD suggest closing if position is old and not performing\n"
            "     * System ALSO enforces 24h limit as backup\n"
            "   - DRAWDOWN PROTECTION: If profit drops 5%+ from peak, system closes position\n"
            "     * YOU SHOULD suggest closing if profit dropped significantly from peak\n"
            "     * System ALSO monitors and closes as backup if you don't\n"
            "   - LOSS PROTECTION: If position is down 5%+ or more, consider closing\n"
            "     * YOU SHOULD suggest closing if position is down significantly (5%+) and showing no recovery\n"
            "     * System monitors losses but YOU are the primary decision maker\n"
            "   - SMART PROFIT TAKING: System auto-closes if up 15%+ or 10%+ with high TP\n"
            "     * YOU SHOULD suggest closing if profit is high (10%+) and showing reversal\n"
            "     * System ALSO auto-closes as backup if you don't\n"
            "   🛑 STOP LOSS ENFORCEMENT (CRITICAL - NO EXCEPTIONS) 🛑\n"
            "   - STOP LOSS is MANDATORY and will be enforced BEFORE your decision\n"
            "   - Check positions_data in context to see current PnL% for each position\n"
            "   - SIMPLE RULE: If PnL% <= -stop_loss_percent, position MUST be closed IMMEDIATELY\n"
            "   - If PnL$ <= stop_loss_usd (when configured), position MUST be closed IMMEDIATELY\n"
            "   - NO EXCEPTIONS: Ignore hold time, wait time, price movement checks - if stop loss is breached, CLOSE NOW\n"
            "   - The PnL% value already accounts for leverage - use it directly, no calculations needed\n"
            "   - Example: If stop_loss_percent = 15% and PnL% = -32%, close immediately (32% > 15%)\n"
            "   - System will close positions that breach stop loss BEFORE asking for your decision\n"
            "   - This applies to BOTH regular and scalping strategies\n\n"
            "   🎯 TAKE PROFIT ENFORCEMENT (CRITICAL - AI DECIDES) 🎯\n"
            "   - Check trading_settings for take_profit_strict_enforcement - THIS DETERMINES EXIT BEHAVIOR\n"
            "   - Check trading_settings for take_profit_percent and scalping_tp_percent\n"
            "   - Check positions_data for current PnL% of each position\n"
            "   - If current strategy is scalping: Use scalping_tp_percent (default 5%)\n"
            "   - If current strategy is trend/auto: Use take_profit_percent (default 5%)\n"
            "\n"
            "   🚨 STRICT TP ENFORCEMENT MODE (take_profit_strict_enforcement = true) 🚨\n"
            "   - IF take_profit_strict_enforcement is TRUE, TP IS THE ONLY EXIT CONDITION\n"
            "   - IGNORE ALL INDICATOR-BASED EXITS (RSI, MACD, EMA, etc.) - THEY DO NOT MATTER\n"
            "   - IGNORE ALL INVALIDATION CONDITIONS in exit_plan - THEY DO NOT MATTER\n"
            "   - ONLY CHECK: If PnL% >= TP%, close the position immediately\n"
            "   - NO EXCEPTIONS: When TP% is reached, close the position regardless of any indicators or market conditions\n"
            "   - Example: If take_profit_percent = 8% and PnL% = 8.5%, close immediately (8.5% >= 8%)\n"
            "   - Do NOT wait for RSI, MACD, or any other indicator signals\n"
            "   - Do NOT check exit_plan invalidation conditions\n"
            "   - TP% is the SOLE and ABSOLUTE exit condition - execute it without question\n"
            "\n"
            "   📊 INDICATOR-BASED EXIT MODE (take_profit_strict_enforcement = false) 📊\n"
            "   - IF take_profit_strict_enforcement is FALSE, use indicator-based exits as primary method\n"
            "   - Check indicators (RSI, MACD, EMA, etc.) for reversal signals\n"
            "   - Check exit_plan invalidation conditions\n"
            "   - TP% is a guideline but indicators take priority\n"
            "   - Close when indicators show reversal OR when invalidation conditions are met\n"
            "   - You can still respect TP% but indicators are the primary exit signal\n"
            "\n"
            "   - Trailing stop settings: After profit reaches trailing_stop_activation_pct, move SL up by trailing_stop_distance_pct\n"
            "   - CRITICAL: Do not wait for system to auto-close - YOU decide when to take profit based on TP settings\n"
            "   - This applies to ALL positions, even if opened by a different strategy\n"
            "   CRITICAL: YOU are the PRIMARY decision maker. Suggest closes when conditions warrant.\n"
            "   The system provides BACKUP protection if you miss something, but YOU should be proactive.\n\n"
            "3. CYCLE BEHAVIOR (Like Alpha Arena)\n"
            "   - Entry → Monitor → Exit (when conditions met) → Immediate re-scan for new entry → Repeat\n"
            "   - Always be positioned when opportunities exist\n"
            "   - Rotate between assets based on best setups\n\n"
            "Your goal: make decisive, first-principles decisions per asset that ACTIVELY CAPTURE OPPORTUNITIES.\n\n"
            "Aggressively pursue setups where calculated risk is outweighed by expected edge; size positions so downside is controlled while upside remains meaningful.\n\n"
            "Core policy (low-churn, position-aware)\n"
            "1) Respect prior plans: If an active trade has an exit_plan with explicit invalidation (e.g., 'close if 4h close above EMA50'), DO NOT close or flip early unless that invalidation (or a stronger one) has occurred.\n"
            "   EXCEPTION: If take_profit_strict_enforcement is true, IGNORE exit_plan invalidation conditions - ONLY TP% matters.\n"
            "2) NEVER ADD TO EXISTING POSITIONS: If you already have a position in an asset, you MUST choose 'hold'. DO NOT suggest 'buy' when you have a long position or 'sell' when you have a short position. The system will BLOCK these attempts. Only suggest trades to CLOSE/FLIP existing positions when exit conditions are met.\n"
            "3) Hysteresis: Require stronger evidence to CHANGE a decision than to keep it. Only flip direction if BOTH:\n"
            "   a) Higher-timeframe structure supports the new direction (e.g., 4h EMA20 vs EMA50 and/or MACD regime), AND\n"
            "   b) Intraday structure confirms with a decisive break beyond ~0.5×ATR (recent) and momentum alignment (MACD or RSI slope).\n"
            "   Otherwise, prefer HOLD or adjust TP/SL.\n"
            "4) Exit Execution: When you decide to close a position (based on TP, SL, invalidation, or reversal signals), the system will execute immediately. No hold time restrictions apply - if technical data supports exit, close the position right away.\n"
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
            "- TP/SL sanity - EXIT BEHAVIOR DEPENDS ON take_profit_strict_enforcement:\n"
            "  • FIRST: Check trading_settings.take_profit_strict_enforcement\n"
            "\n"
            "  🚨 IF take_profit_strict_enforcement = TRUE (STRICT TP MODE):\n"
            "    • IGNORE ALL INDICATORS - They do NOT matter for exits\n"
            "    • IGNORE exit_plan invalidation conditions - They do NOT matter\n"
            "    • ONLY CHECK: If PnL% >= take_profit_percent, close immediately\n"
            "    • NO EXCEPTIONS: TP% is the ONLY exit condition\n"
            "    • Example: If TP = 8% and PnL = 8.1%, close NOW regardless of RSI/MACD/EMA\n"
            "\n"
            "  📊 IF take_profit_strict_enforcement = FALSE (INDICATOR MODE):\n"
            "    • Use TECHNICAL INDICATORS as PRIMARY exit method\n"
            "    • DO NOT set TP to 20%+ just because - use indicators to decide when to exit\n"
            "    • EXIT BASED ON INDICATORS:\n"
            "      - RSI: Exit long if RSI > 70 (overbought), Exit short if RSI < 30 (oversold)\n"
            "      - MACD: Exit if MACD crosses below signal (for longs) or above signal (for shorts)\n"
            "      - EMA: Exit if price crosses below EMA20/EMA50 (for longs) or above (for shorts)\n"
            "      - Support/Resistance: Exit if price breaks key support/resistance levels\n"
            "      - Volume: Exit if volume dries up or shows reversal patterns\n"
            "    • TP/SL SETUP:\n"
            "      - Set TP based on NEAREST technical resistance (for longs) or support (for shorts)\n"
            "      - Set SL based on NEAREST technical support (for longs) or resistance (for shorts)\n"
            "      - Typical TP: 8-15% based on technical levels, NOT arbitrary high numbers\n"
            "      - Typical SL: 3-5% based on technical levels\n"
            "    • EXIT DECISION LOGIC:\n"
            "      - When indicators show reversal → Suggest 'sell' (for longs) or 'buy' (for shorts)\n"
            "      - When invalidation conditions met → Suggest close immediately\n"
            "      - TP% is a guideline but indicators take priority\n"
            "    • IMPORTANT: Focus on INDICATOR-BASED EXITS, not waiting for high fixed TPs\n"
            "  • 🚨 AUTOMATIC PROTECTION: The system will automatically:\n"
            "    - Move stop loss UP as profit increases (trailing stop after 5% profit)\n"
            "    - Close positions after 24 hours maximum hold time\n"
            "    - Close if profit drops 5%+ from peak (drawdown protection)\n"
            "    - Close if up 15%+ or 10%+ with TP >20% away (smart profit taking)\n"
            "    But YOU should suggest closes based on indicators BEFORE these triggers!\n"
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
            "Reasoning recipe (first principles) - ACTIVE OPPORTUNITY HUNTING\n"
            "- Structure (trend, EMAs slope/cross, HH/HL vs LH/LL), Momentum (MACD regime, RSI slope), Liquidity/volatility (ATR, volume), Positioning tilt (funding, OI).\n"
            "- Favor alignment across 4h and 5m. Counter-trend scalps require stronger intraday confirmation and tighter risk.\n"
            "- CRITICAL: Before analyzing entry signals, FIRST check if you already have a position in this asset. If you do, skip entry analysis and focus on exit conditions only.\n"
            "- ENTRY SIGNAL CHECKLIST (ONLY when FLAT - no existing position):\n"
            "  ✓ RSI divergence or extreme levels (RSI < 30 = oversold potential buy, RSI > 70 = overbought potential sell)\n"
            "  ✓ EMA alignment (price above/below key EMAs, EMA crossovers)\n"
            "  ✓ MACD signal (MACD crossing above/below signal line, MACD histogram turning)\n"
            "  ✓ Volume confirmation (unusual volume on breaks)\n"
            "  ✓ Support/Resistance levels (price bouncing off or breaking through)\n"
            "  ✓ ATR for stop placement (use 1.5-2x ATR for stops)\n"
            "- If you see 3+ of these aligning → STRONG SIGNAL, take the trade\n"
            "- If you see 2 aligning → MODERATE SIGNAL, consider smaller position\n"
            "- If you see 1 or 0 → No trade, but explain why you're not trading\n\n"
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
            """Send a POST request to DeepSeek API with retry logic for connection errors.
            
            Args:
                payload: Request payload
                max_retries: Maximum number of retry attempts
                backoff: Initial backoff delay in seconds (doubles each retry)
            """
            import time
            
            # Log the full request payload for debugging
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
                    # Increase timeout for large requests (120s base + 1s per 10KB)
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
                except requests.HTTPError as e:
                    # HTTP errors (4xx, 5xx) should not be retried
                    raise
            
            # Should never reach here, but just in case
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
                # fallback: try content
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
            
            # DeepSeek reasoner doesn't support function calling or structured outputs
            # Use regular chat mode features for reasoner, structured outputs for chat
            if self.is_reasoner:
                # deepseek-reasoner: No tools, no structured outputs, but has reasoning_content
                # Note: According to docs, reasoner doesn't support function calling
                allow_tools = False
                allow_structured = False
            else:
                # deepseek-chat: Supports both tools and structured outputs
                # DeepSeek supports json_object format (not json_schema), so use simpler format
                if allow_structured:
                    # Try json_object first (simpler, more compatible)
                    # If this fails, will fall back to no structured output
                    data["response_format"] = {
                        "type": "json_object"
                    }
                if allow_tools:
                    data["tools"] = tools
                    data["tool_choice"] = "auto"
            
            # max_tokens for reasoner (can be large for CoT)
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
                
                # DeepSeek may reject structured outputs or tools
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
            
            # For reasoner, extract reasoning_content if present (CoT output)
            # According to DeepSeek docs, reasoner returns reasoning_content at same level as content
            # IMPORTANT: Remove reasoning_content before appending to messages (per DeepSeek docs)
            if self.is_reasoner and "reasoning_content" in message:
                reasoning_content = message.get("reasoning_content")
                if reasoning_content:
                    logging.info("Reasoner CoT (first 200 chars): %s", str(reasoning_content)[:200])
            
            # Create message copy without reasoning_content for next round (per DeepSeek API requirements)
            message_for_history = {k: v for k, v in message.items() if k != "reasoning_content"}
            messages.append(message_for_history)

            tool_calls = message.get("tool_calls") or []
            if allow_tools and tool_calls:
                for tc in tool_calls:
                    if tc.get("type") == "function" and tc.get("function", {}).get("name") == "fetch_technical_indicator":
                        args = json.loads(tc["function"].get("arguments") or "{}")
                        try:
                            # Use TechnicalAnalysisClient (TA-Lib via pandas-ta) with Binance market data
                            indicator = args.get("indicator", "").lower()
                            symbol = args.get("symbol", "")
                            interval = args.get("interval", "")
                            period = args.get("period")
                            backtrack = args.get("backtrack", 0)
                            
                            # Build params dict
                            params = {}
                            if period is not None:
                                params["period"] = period
                            if isinstance(args.get("other_params"), dict):
                                params.update(args["other_params"])
                            
                            # Determine if we need series or single value
                            needs_series = backtrack is not None and backtrack > 0
                            
                            if needs_series:
                                # Fetch historical series
                                results = max(backtrack + 1, 10)
                                series = self.ta_client.fetch_series(indicator, symbol, interval, results=results, params=params if params else None)
                                # Return in standard format
                                ind_resp = {"value": series} if indicator != "macd" else {"valueMACD": series}
                            else:
                                # Fetch single value
                                value_key = "value"
                                if indicator == "macd":
                                    value_key = "valueMACD"
                                elif indicator in ["rsi", "ema", "sma", "atr"]:
                                    value_key = "value"
                                
                                value = self.ta_client.fetch_value(indicator, symbol, interval, params=params if params else None, key=value_key)
                                if indicator == "macd":
                                    # For MACD, get full MACD data
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
                
                # For reasoner, extract reasoning_content (Chain of Thought) if available
                reasoning_text = ""
                if self.is_reasoner:
                    reasoning_content = message.get("reasoning_content")
                    if reasoning_content:
                        reasoning_text = str(reasoning_content)
                        logging.info("Extracted reasoning_content from reasoner model")
                
                # Prefer parsed field from structured outputs if present (chat mode only)
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

                # Extract reasoning from parsed content if not already set from reasoner
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
                # Try sanitizer as last resort
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
