# Dashboard Setup & Integration Guide

## Quick Start

### 1. Install Dependencies

```bash
cd dashboard
npm install
```

### 2. Configure Environment

Create `.env.local` file in the `dashboard` folder:

```env
# Python Trading Agent API (Required)
# If Python agent runs on different port, update this
NEXT_PUBLIC_API_URL=http://localhost:3000

# Supabase (Optional - only if you want persistent storage)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Handle Port Configuration

**Both Python agent and Next.js default to port 3000!**

**Option A: Change Python Agent Port (Recommended)**
- Edit `.env` in project root:
  ```env
  API_PORT=3001
  ```
- Update `dashboard/.env.local`:
  ```env
  NEXT_PUBLIC_API_URL=http://localhost:3001
  ```

**Option B: Change Next.js Port**
- Run dashboard with different port:
  ```bash
  npm run dev:3001
  ```
- Or: `next dev -p 3001`

### 4. Start Services

**Terminal 1 - Python Trading Agent:**
```bash
# From project root
poetry run python src/main.py --assets BTC ETH SOL BNB DOGE --interval 5m
```

**Terminal 2 - Next.js Dashboard:**
```bash
cd dashboard
npm run dev
```

### 5. Open Dashboard

- Dashboard: http://localhost:3000
- Python API: http://localhost:3000/diary (or port you configured)

## Integration Status

✅ **Working:**
- DecisionsFeed → Connects to Python `/diary` endpoint
- TradingLogs → Connects to Python `/logs` endpoint
- Data transformation from Python format to TypeScript types
- Supabase fallback (if configured)

## Testing Integration

1. **Test Python API:**
   ```bash
   curl http://localhost:3000/diary?limit=5
   curl http://localhost:3000/logs?limit=5
   ```

2. **Test Dashboard API Routes:**
   ```bash
   curl http://localhost:3000/api/decisions?limit=5
   curl http://localhost:3000/api/logs?limit=5
   ```

3. **Check Browser Console:**
   - Open http://localhost:3000
   - Check for any errors in browser DevTools console

## Troubleshooting

### Decisions Not Showing
- Verify Python agent is running
- Check `diary.jsonl` exists in project root
- Verify `.env.local` has correct `NEXT_PUBLIC_API_URL`
- Check browser console for fetch errors

### Logs Not Showing
- Verify `llm_requests.log` exists
- Check Python agent is generating logs
- Verify logs endpoint: `curl http://localhost:3000/logs?limit=5`

### Port Conflicts
- Use Option A or B above to change ports
- Make sure `.env.local` points to correct Python API URL

### CORS Errors
- Python API should allow requests from dashboard
- Check if both are on same localhost

## Component Status

All components from your original dashboard are integrated:
- ✅ DecisionsFeed (connected to Python API)
- ✅ TradingLogs (connected to Python API)
- ✅ AccountMetrics
- ✅ PositionsTable
- ✅ OrdersTable
- ✅ OverviewStats
- ✅ PerformanceChart
- ✅ PnLChart
- ✅ TradingControls
- ✅ AssetManager
- ✅ OpenPositionsCompact
- ✅ AiChat
- ✅ Topbar & Footer

Note: Components that need additional API endpoints will show mock/empty data until those endpoints are connected.

