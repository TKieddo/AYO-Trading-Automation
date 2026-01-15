import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

export type MonthlyAccountValueData = {
  date: Date;
  openingBalance: number;
  closingBalance: number;
  gains: number;
  losses: number;
};

type BalanceHistoryRecord = {
  account_value: string | number | null;
  timestamp: string;
};

type PortfolioActivityRecord = {
  type: string;
  amount: string | number | null;
  timestamp: string;
};

/**
 * GET: Fetch monthly account value data for the last 12 months
 * Calculates opening/closing balances and gains/losses per month
 */
export async function GET(req: NextRequest) {
  try {
    const sb = getServerSupabase();
    if (!sb) {
      return NextResponse.json({ error: "Database not available" }, { status: 500 });
    }

    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1); // Start of month 12 months ago

    // Step 1: Get account value history for last 12 months
    const { data: balanceHistoryData, error: balanceError } = await sb
      .from("wallet_balance_history")
      .select("account_value, timestamp")
      .gte("timestamp", twelveMonthsAgo.toISOString())
      .order("timestamp", { ascending: true });

    if (balanceError) throw balanceError;

    // Step 2: Get portfolio activities for last 12 months
    const { data: activitiesData, error: activitiesError } = await sb
      .from("portfolio_activities")
      .select("type, amount, timestamp")
      .gte("timestamp", twelveMonthsAgo.toISOString())
      .order("timestamp", { ascending: true });

    if (activitiesError) throw activitiesError;

    // Type the query results explicitly
    const balanceHistory: BalanceHistoryRecord[] = (balanceHistoryData || []) as BalanceHistoryRecord[];
    const activities: PortfolioActivityRecord[] = (activitiesData || []) as PortfolioActivityRecord[];

    // Step 3: Group data by month
    const monthlyData: Map<string, MonthlyAccountValueData> = new Map();

    // Initialize all 12 months
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
      
      monthlyData.set(monthKey, {
        date: monthDate,
        openingBalance: 0,
        closingBalance: 0,
        gains: 0,
        losses: 0,
      });
    }

    // Step 4: Process balance history to get opening/closing balances per month
    if (balanceHistory && balanceHistory.length > 0) {
      for (const record of balanceHistory) {
        const recordDate = new Date(record.timestamp);
        const monthKey = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, "0")}`;
        const monthData = monthlyData.get(monthKey);
        
        if (monthData) {
          const accountValue = Number(record.account_value || 0);
          
          // Opening balance: first record of the month
          if (monthData.openingBalance === 0 || recordDate.getDate() === 1) {
            monthData.openingBalance = accountValue;
          }
          
          // Closing balance: last record of the month
          monthData.closingBalance = accountValue;
        }
      }
    }

    // Step 5: Process activities to calculate gains/losses per month
    if (activities && activities.length > 0) {
      for (const activity of activities) {
        const activityDate = new Date(activity.timestamp);
        const monthKey = `${activityDate.getFullYear()}-${String(activityDate.getMonth() + 1).padStart(2, "0")}`;
        const monthData = monthlyData.get(monthKey);
        
        if (monthData) {
          const amount = Number(activity.amount || 0);
          
          // Gains: positive amounts (deposits, profits, funding received)
          if (amount > 0) {
            monthData.gains += amount;
          } 
          // Losses: negative amounts (fees, withdrawals, funding paid)
          else if (amount < 0) {
            monthData.losses += Math.abs(amount);
          }
        }
      }
    }

    // Step 6: Fill in missing opening balances (use previous month's closing)
    let previousClosing = 0;
    const sortedMonths = Array.from(monthlyData.entries()).sort((a, b) => 
      a[1].date.getTime() - b[1].date.getTime()
    );

    for (const [monthKey, monthData] of sortedMonths) {
      if (monthData.openingBalance === 0 && previousClosing > 0) {
        monthData.openingBalance = previousClosing;
      }
      if (monthData.closingBalance === 0 && monthData.openingBalance > 0) {
        monthData.closingBalance = monthData.openingBalance;
      }
      previousClosing = monthData.closingBalance || monthData.openingBalance;
    }

    // Step 7: Convert to array and format for response
    const result = Array.from(monthlyData.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((data) => ({
        date: data.date.toISOString(),
        openingBalance: data.openingBalance,
        closingBalance: data.closingBalance,
        gains: data.gains,
        losses: data.losses,
      }));

    return NextResponse.json({
      monthlyData: result,
      totalMonths: result.length,
    });
  } catch (error: any) {
    console.error("Error in monthly account value API:", error);
    return NextResponse.json(
      {
        error: error?.message || "Failed to fetch monthly account value data",
        monthlyData: [],
      },
      { status: 500 }
    );
  }
}

