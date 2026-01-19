// Trading-related types

export interface PriceData {
  symbol: string;
  price: number;
  change24h: number;
  change24hPercent: number;
  timestamp: string;
}

export interface Position {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  currentPrice: number;
  liquidationPrice: number;
  unrealizedPnl: number;
  realizedPnl: number;
  leverage?: number; // From Binance API
  initialMargin?: number; // Actual margin used (from exchange)
  roiPercent?: number; // ROI percentage from Binance API (unRealizedProfit / positionInitialMargin * 100)
  notional?: number; // Notional value from Binance API
  openedAt: string; // ISO timestamp or timestamp in ms
  openTime?: number; // Timestamp in milliseconds from Binance API
  updatedAt: string;
}

export interface Order {
  id: string;
  orderId: number;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'take_profit';
  size: number;
  price?: number;
  status: 'open' | 'filled' | 'canceled' | 'rejected' | 'triggered';
  filledSize: number;
  createdAt: string;
  updatedAt: string;
}

export interface Trade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  size: number;
  price: number;
  fee: number;
  pnl?: number;
  executedAt: string;
  orderId?: string;
}

export interface AccountMetrics {
  totalValue: number;
  balance: number;
  openPositions: number;
  totalPnL: number;
  dailyPnL: number;
  winRate: number;
  totalTrades: number;
  leverage: number;
}

export interface TradingLog {
  id: string;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  data?: Record<string, any>;
  timestamp: string;
}

export interface Decision {
  id: string;
  asset: string;
  action: 'buy' | 'sell' | 'hold';
  allocationUsd: number;
  tpPrice?: number;
  slPrice?: number;
  rationale: string;
  reasoning?: string;
  timestamp: string;
}

