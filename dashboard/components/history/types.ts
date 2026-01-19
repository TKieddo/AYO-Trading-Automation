export type HistoryTrade = {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  size: number;
  price: number;
  fee: number;
  pnl: number | null; // Can be null for trades without realized PnL (open positions)
  timestamp: string;
};

export type HistoryOrder = {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  type: "market" | "limit";
  size: number;
  price?: number;
  status: "open" | "filled" | "canceled" | "rejected" | "triggered";
  createdAt: string;
};


