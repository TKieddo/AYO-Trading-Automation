# DeepSeek API Integration Guide

## Overview

The trading agent now uses **DeepSeek API directly** instead of OpenRouter. DeepSeek V3.1 was tested on Alpha Arena and showed superior trading performance.

## Configuration

### Required Environment Variables

Add these to your `.env` file:

```env
# DeepSeek API Configuration
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# Model Selection (choose one)
LLM_MODEL=deepseek-chat        # Fast mode, supports function calling + JSON
# OR
LLM_MODEL=deepseek-reasoner     # Reasoning mode with Chain of Thought (CoT)

# Optional Settings
DEEPSEEK_BASE_URL=https://api.deepseek.com  # Default if not specified
DEEPSEEK_MAX_TOKENS=64000                   # Max tokens for reasoner (default: 64000)
```

## Model Options

### `deepseek-chat` (Recommended for Trading)

**Features:**
- ✅ Fast response times
- ✅ Supports function calling (technical indicator lookups)
- ✅ Supports structured JSON outputs
- ✅ Lower latency for real-time decisions
- ✅ Cost-effective

**Best For:**
- Active trading with frequent decisions
- When you need function calling for indicators
- Speed-critical operations

### `deepseek-reasoner` (Best Performance)

**Features:**
- ✅ Chain of Thought (CoT) reasoning
- ✅ Superior reasoning quality (tested best on Alpha Arena)
- ✅ Detailed step-by-step analysis
- ✅ Better for complex trading decisions
- ❌ **No function calling support** (according to DeepSeek docs)
- ❌ **No structured outputs** (JSON parsing required)

**Best For:**
- Maximum decision quality
- Complex market analysis
- When you can sacrifice some speed for better reasoning

**Note:** Since reasoner doesn't support function calling, the agent will disable indicator lookups when using this model. All analysis must be based on pre-fetched data in the context.

## Getting Your API Key

1. Go to [DeepSeek Platform](https://platform.deepseek.com)
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key to your `.env` file

## Migration from OpenRouter

### Before (OpenRouter):
```env
OPENROUTER_API_KEY=your_key
LLM_MODEL=x-ai/grok-4
```

### After (DeepSeek):
```env
DEEPSEEK_API_KEY=your_key
LLM_MODEL=deepseek-chat
# or
LLM_MODEL=deepseek-reasoner
```

## How It Works

### DeepSeek Chat Mode (`deepseek-chat`)

1. Agent sends market data + instructions to DeepSeek
2. DeepSeek can call functions to fetch additional indicators
3. DeepSeek returns structured JSON with trading decisions
4. Agent executes trades based on decisions

**Request Flow:**
```
Context → DeepSeek API → Function Calls (optional) → JSON Response → Trade Execution
```

### DeepSeek Reasoner Mode (`deepseek-reasoner`)

1. Agent sends market data + instructions to DeepSeek
2. DeepSeek generates Chain of Thought reasoning (reasoning_content)
3. DeepSeek returns final answer (content) with reasoning
4. Agent parses JSON from content
5. Agent executes trades based on decisions

**Request Flow:**
```
Context → DeepSeek API → CoT Reasoning → Final Answer → JSON Parse → Trade Execution
```

**Important:** Reasoner doesn't support function calling, so all indicator data must be included in the initial context.

## API Endpoints

DeepSeek uses OpenAI-compatible API:

- **Base URL:** `https://api.deepseek.com`
- **Endpoint:** `/chat/completions`
- **Method:** POST
- **Headers:**
  ```
  Authorization: Bearer {DEEPSEEK_API_KEY}
  Content-Type: application/json
  ```

## Response Format

### Chat Mode Response:
```json
{
  "choices": [{
    "message": {
      "content": "{...json with trading decisions...}"
    }
  }]
}
```

### Reasoner Mode Response:
```json
{
  "choices": [{
    "message": {
      "reasoning_content": "Chain of Thought analysis here...",
      "content": "{...json with trading decisions...}"
    }
  }]
}
```

## Cost Considerations

DeepSeek pricing is typically more cost-effective than OpenRouter:
- Chat mode: Lower cost, faster
- Reasoner mode: Higher cost (due to CoT), but better quality

Check [DeepSeek Pricing](https://platform.deepseek.com/pricing) for current rates.

## Troubleshooting

### Error: "Missing required environment variable: DEEPSEEK_API_KEY"
- Make sure `DEEPSEEK_API_KEY` is set in your `.env` file

### Error: "DeepSeek rejected structured outputs"
- Using reasoner? Reasoner doesn't support structured outputs - this is expected
- The agent will automatically retry without structured outputs

### Error: "DeepSeek rejected tools"
- Using reasoner? Reasoner doesn't support function calling - this is expected
- The agent will disable function calls automatically

### Model not responding
- Check your API key is valid
- Verify you have credits/quota
- Check network connectivity
- Review `llm_requests.log` for detailed error messages

## Testing

1. Set `DEEPSEEK_API_KEY` in `.env`
2. Set `LLM_MODEL=deepseek-chat` (or `deepseek-reasoner`)
3. Start the agent: `poetry run python src/main.py --assets BTC --interval 5m`
4. Check logs: `llm_requests.log` contains all API requests/responses

## Performance Tips

1. **For Speed:** Use `deepseek-chat` with function calling enabled
2. **For Quality:** Use `deepseek-reasoner` (tested best on Alpha Arena)
3. **For Cost:** Use `deepseek-chat` for frequent checks
4. **For Complex Decisions:** Use `deepseek-reasoner` for better reasoning

## References

- [DeepSeek API Docs](https://api-docs.deepseek.com/)
- [DeepSeek Reasoning Model Guide](https://api-docs.deepseek.com/guides/reasoning_model)
- [DeepSeek Platform](https://platform.deepseek.com)

