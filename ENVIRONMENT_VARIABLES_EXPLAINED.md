# 🔑 Environment Variables Explained

Clear breakdown of which variables are **REQUIRED** vs **OPTIONAL** for your Python trading agent.

---

## ✅ REQUIRED Variables

**Your agent WILL NOT start without these:**

### 1. DeepSeek API (REQUIRED)
```env
DEEPSEEK_API_KEY=sk-your-key-here
```
- **Why:** Agent uses DeepSeek LLM for trading decisions
- **Without it:** `RuntimeError: Missing required environment variable: DEEPSEEK_API_KEY`

### 2. Exchange Selection (REQUIRED)
```env
EXCHANGE=binance
# OR
EXCHANGE=aster
```
- **Why:** Tells agent which exchange to use
- **Without it:** Will default to "aster" but won't work without credentials

### 3. Exchange Credentials (REQUIRED)

**If using Binance:**
```env
BINANCE_API_KEY=your_key
BINANCE_API_SECRET=your_secret
```

**OR if using Aster:**
```env
ASTER_USER_ADDRESS=your_address
ASTER_SIGNER_ADDRESS=your_signer
ASTER_PRIVATE_KEY=your_private_key
```

- **Why:** Agent needs these to connect to the exchange
- **Without it:** Agent can't trade

---

## ⚠️ OPTIONAL Variables

**These are NOT required for the agent to start, but recommended:**

### TAAPI_API_KEY (Optional)
```env
TAAPI_API_KEY=your_taapi_key
```
- **Why:** For fetching technical indicators from TAAPI service
- **Without it:** Agent uses TA-Lib + Binance data instead (works fine)
- **Status:** Optional - kept for backwards compatibility

### Supabase Variables (Optional for Agent, Required for Dashboard)

**For Python Agent (Railway):**
```env
# NOT needed directly - agent fetches settings from dashboard API
```

**For Dashboard (Vercel) - REQUIRED for Settings Page:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**How it works:**
1. **Dashboard (Vercel)** stores trading settings in Supabase
2. **Python Agent** fetches settings from Dashboard API: `{dashboard_url}/api/trading/settings`
3. Dashboard API reads from Supabase and returns to agent

**Without Supabase:**
- ❌ Dashboard settings page won't work (can't save/load settings)
- ⚠️ Agent will fall back to `.env` defaults (but can't use dashboard settings)
- ✅ Agent still runs, but you can't change settings via dashboard

**For Trade Syncing (Separate Feature):**
```env
# Python Agent only (for syncing trades to database)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_anon_key
# OR (recommended)
SUPABASE_SERVICE_KEY=your_service_role_key
```
- **Why:** Automatically syncs trades to Supabase database
- **Without it:** Agent runs fine, but trades won't be saved to database
- **Note:** Only works with Binance exchange (not Aster)
- **Status:** Optional - agent will log "Supabase not configured - skipping trade sync"

---

## 📊 Summary Table

| Variable | Required? | What Happens Without It |
|----------|-----------|------------------------|
| `DEEPSEEK_API_KEY` | ✅ **YES** | ❌ Agent won't start |
| `EXCHANGE` | ✅ **YES** | ⚠️ Defaults to "aster" |
| `BINANCE_API_KEY` + `BINANCE_API_SECRET` | ✅ **YES** (if using Binance) | ❌ Can't connect to Binance |
| `ASTER_*` credentials | ✅ **YES** (if using Aster) | ❌ Can't connect to Aster |
| `TAAPI_API_KEY` | ❌ No | ✅ Uses TA-Lib + Binance instead |
| `SUPABASE_URL` + `SUPABASE_KEY` (Agent) | ❌ No | ✅ Agent runs, but trades not synced to DB |
| `NEXT_PUBLIC_SUPABASE_*` (Dashboard) | ✅ **YES** | ❌ Dashboard settings page won't work |

---

## 🎯 For Railway Deployment

### Minimum to Start:
```env
DEEPSEEK_API_KEY=sk-your-key
EXCHANGE=binance
BINANCE_API_KEY=your_key
BINANCE_API_SECRET=your_secret
```

### Recommended (Full Setup):
```env
# Required
DEEPSEEK_API_KEY=sk-your-key
EXCHANGE=binance
BINANCE_API_KEY=your_key
BINANCE_API_SECRET=your_secret

# Optional but Recommended
TAAPI_API_KEY=your_taapi_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key

# Trading Config (can change via dashboard)
ASSETS=BTC ETH SOL
INTERVAL=5m
## 💡 Pro Tips

1. **Start with minimum required** - Get agent running first
2. **Add Supabase later** - If you want trade history in database
3. **TAAPI is optional** - Agent works fine without it
4. **Use SUPABASE_SERVICE_KEY** - Better than SUPABASE_KEY for server-side (bypasses RLS)


## 🆘 Troubleshooting

**"Missing required environment variable: DEEPSEEK_API_KEY"**
- ✅ Add `DEEPSEEK_API_KEY` to Railway variables

**"Supabase not configured - skipping trade sync"**
- ⚠️ This is OK! Agent still works, just won't save trades to database
- ✅ Add Supabase variables if you want trade syncing

**"TAAPI error"**
- ⚠️ This is OK! Agent uses TA-Lib + Binance instead
- ✅ Add `TAAPI_API_KEY` if you prefer TAAPI service

---

**Bottom Line:** Only `DEEPSEEK_API_KEY` and exchange credentials are **REQUIRED**. Everything else is optional but recommended for full functionality.
