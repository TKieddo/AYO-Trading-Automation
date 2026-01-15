# AYO (Trading Ai Agent) Dashboard

Beautiful, real-time trading dashboard built with Next.js, TypeScript, and Tailwind CSS.

## Features

- 🎯 **Real-time Price Ticker** - Live prices for major cryptocurrencies
- 💰 **Account Metrics** - Total value, balance, P&L, win rate
- 📊 **Positions Table** - All open positions with P&L
- 📋 **Orders Table** - Recent orders and their status
- 🧠 **AI Decisions Feed** - Real-time AI agent trading decisions
- 📝 **Trading Logs** - Activity logs and system messages
- 🎨 **Beautiful UI** - Modern, responsive design with dark mode support

## Setup

### 1. Install Dependencies

```bash
cd dashboard
npm install
```

### 2. Configure Environment

Copy `.env.local.example` to `.env.local` and fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Setup Supabase

1. Create a Supabase project
2. Run the schema SQL: `supabase/schema.sql`
3. Update your `.env.local` with Supabase credentials

### 4. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Project Structure

```
dashboard/
├── app/                    # Next.js App Router
│   ├── api/               # API routes (mock data currently)
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Main dashboard page
├── components/
│   ├── dashboard/         # Dashboard components
│   │   ├── PriceTicker.tsx
│   │   ├── AccountMetrics.tsx
│   │   ├── PositionsTable.tsx
│   │   ├── OrdersTable.tsx
│   │   ├── TradingLogs.tsx
│   │   └── DecisionsFeed.tsx
│   └── ui/                # Reusable UI components
│       └── card.tsx
├── lib/
│   ├── supabase/          # Supabase client
│   ├── types.ts           # TypeScript types
│   └── utils.ts           # Utility functions
└── supabase/
    └── schema.sql         # Database schema
```

## Current Status

Currently using mock data. To connect to real data:

1. Update API routes in `app/api/` to query Supabase
2. Set up data sync from Python trading agent to Supabase
3. Enable real-time subscriptions in components

## Next Steps

1. ✅ Dashboard UI components created
2. ⏳ Connect to Supabase
3. ⏳ Add real-time data sync
4. ⏳ Connect Python agent to dashboard
5. ⏳ Add charts and performance graphs

