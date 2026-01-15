# Dashboard Setup Guide

## Quick Start

### Step 1: Install Dependencies

```bash
cd dashboard
npm install
```

### Step 2: Setup Supabase (Optional for now)

1. Go to [supabase.com](https://supabase.com) and create a project
2. Copy your project URL and anon key
3. Run the SQL schema: Copy `supabase/schema.sql` content into Supabase SQL Editor and execute
4. Update `.env.local` with your credentials

### Step 3: Run Dashboard

```bash
npm run dev
```

The dashboard runs on [http://localhost:3000](http://localhost:3000)

**Note**: Currently uses mock data. See "Connecting Real Data" below.

## Dashboard Features

### ✅ Completed Components

1. **Price Ticker** - Real-time cryptocurrency prices
2. **Account Metrics** - Balance, P&L, win rate, positions
3. **Positions Table** - All open positions with details
4. **Orders Table** - Recent orders with status
5. **Trading Logs** - Real-time activity logs
6. **AI Decisions Feed** - Agent decision history

### 🎨 Design Features

- Responsive layout (mobile, tablet, desktop)
- Dark mode support
- Real-time updates (polling, ready for WebSocket)
- Beautiful, modern UI
- Modular component architecture

## Connecting Real Data

### Option 1: Update API Routes to Query Supabase

Edit files in `app/api/` and replace mock data with Supabase queries:

```typescript
import { supabase } from '@/lib/supabase/client';

export async function GET() {
  const { data } = await supabase
    .from('positions')
    .select('*')
    .is('closed_at', null);
  
  return NextResponse.json(data);
}
```

### Option 2: Use Python Agent Directly

Create an API endpoint that queries your Python agent via HTTP/WebSocket.

## Next Steps

1. ✅ Dashboard UI complete
2. ⏳ Connect to Supabase (or Python agent API)
3. ⏳ Add real-time WebSocket updates
4. ⏳ Add performance charts
5. ⏳ Add order placement UI

## Development

- `npm run dev` - Start dev server
- `npm run build` - Build for production
- `npm run start` - Start production server

