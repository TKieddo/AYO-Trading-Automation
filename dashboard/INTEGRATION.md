# Dashboard Integration with Python Trading Agent

## Overview

The dashboard is now integrated with the Python trading agent running on port 3000.

## API Integration

### Decisions Feed

The DecisionsFeed component fetches AI trading decisions from the Python agent:

1. **Frontend:** `DecisionsFeed.tsx` calls `/api/decisions`
2. **API Route:** `app/api/decisions/route.ts` connects to Python agent
3. **Python Endpoint:** `http://localhost:3000/diary` returns `{"entries": [...]}`
4. **Transformation:** Python format is converted to TypeScript `Decision` type

### Trading Logs

The TradingLogs component fetches logs from the Python agent:

1. **Frontend:** `TradingLogs.tsx` calls `/api/logs`
2. **API Route:** `app/api/logs/route.ts` connects to Python agent
3. **Python Endpoint:** `http://localhost:3000/logs?limit=50&path=llm_requests.log`

## Configuration

### Environment Variables

Create `.env.local` in the `dashboard` folder:

```env
# Python Trading Agent API (Required)
NEXT_PUBLIC_API_URL=http://localhost:3000

# Supabase (Optional - for data persistence)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Running the Dashboard

1. **Start Python Trading Agent** (from project root):
   ```bash
   poetry run python src/main.py --assets BTC ETH SOL BNB DOGE --interval 5m
   ```
   This starts the agent and API server on port 3000.

2. **Start Next.js Dashboard**:
   ```bash
   cd dashboard
   npm install
   npm run dev
   ```
   This starts the dashboard on port 3000 (Next.js default).

**Note:** If both run on port 3000, you'll need to change one. The Python agent can use a different port via `API_PORT` env var, or Next.js can use a different port with `npm run dev -p 3001`.

## Data Flow

### Decisions Data Flow:
```
Python Agent (diary.jsonl)
    ↓
Python API (/diary endpoint)
    ↓
Next.js API Route (/api/decisions)
    ↓
DecisionsFeed Component
    ↓
Dashboard UI
```

### Logs Data Flow:
```
Python Agent (llm_requests.log)
    ↓
Python API (/logs endpoint)
    ↓
Next.js API Route (/api/logs)
    ↓
TradingLogs Component
    ↓
Dashboard UI
```

## Supabase (Optional)

If Supabase is configured:
- Dashboard will try Python API first
- Falls back to Supabase if Python API fails
- Supabase can be used for persistent storage and historical data

## Testing

1. Verify Python agent is running:
   ```bash
   curl http://localhost:3000/diary?limit=5
   ```

2. Verify dashboard API routes:
   ```bash
   curl http://localhost:3000/api/decisions?limit=5
   curl http://localhost:3000/api/logs?limit=5
   ```

3. Open dashboard: http://localhost:3000

## Troubleshooting

### Decisions not showing
- Check Python agent is running: `curl http://localhost:3000/diary`
- Check browser console for errors
- Verify `.env.local` has correct `NEXT_PUBLIC_API_URL`

### Logs not showing
- Check Python agent has `llm_requests.log` file
- Verify `/logs` endpoint works: `curl http://localhost:3000/logs?limit=5`

### Port conflicts
- Change Python agent port: Set `API_PORT=3001` in Python `.env`
- Or change Next.js port: `npm run dev -p 3001`

