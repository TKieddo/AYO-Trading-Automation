import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

export type PeriodAccountValueData = {
  date: string; // ISO string
  openingBalance: number;
  closingBalance: number;
  gains: number;
  losses: number;
  periodLabel: string; // Day name, week number, or month name
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
 * GET: Fetch period-based account value data
 * Query params: period (week, month, year)
 */
export async function GET(req: NextRequest) {
  try {
    const sb = getServerSupabase();
    if (!sb) {
      return NextResponse.json({ error: "Database not available" }, { status: 500 });
    }

    const searchParams = req.nextUrl.searchParams;
    const period = searchParams.get("period") || "year"; // Default to year

    const now = new Date();
    let startDate: Date;
    let dataPoints: PeriodAccountValueData[] = [];

    if (period === "week") {
      // Week: Current week (Monday to Sunday)
      const today = new Date(now);
      const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
      // Calculate Monday of current week
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Get to Monday
      const monday = new Date(today);
      monday.setDate(today.getDate() + mondayOffset);
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      startDate = monday;

      // Get balance history for current week
      const { data: balanceHistoryData, error: balanceError } = await sb
        .from("wallet_balance_history")
        .select("account_value, timestamp")
        .gte("timestamp", startDate.toISOString())
        .lte("timestamp", sunday.toISOString())
        .order("timestamp", { ascending: true });

      if (balanceError) throw balanceError;

      // Get activities for current week
      const { data: activitiesData, error: activitiesError } = await sb
        .from("portfolio_activities")
        .select("type, amount, timestamp")
        .gte("timestamp", startDate.toISOString())
        .lte("timestamp", sunday.toISOString())
        .order("timestamp", { ascending: true });

      if (activitiesError) throw activitiesError;

      // Type the query results explicitly
      const balanceHistory: BalanceHistoryRecord[] = (balanceHistoryData || []) as BalanceHistoryRecord[];
      const activities: PortfolioActivityRecord[] = (activitiesData || []) as PortfolioActivityRecord[];

      // Group by day (Monday to Sunday)
      const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      for (let i = 0; i < 7; i++) {
        const dayDate = new Date(monday);
        dayDate.setDate(monday.getDate() + i);
        const dayStart = new Date(dayDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayDate);
        dayEnd.setHours(23, 59, 59, 999);

        // Find opening balance (first record of the day or previous day's closing)
        let openingBalance = 0;
        if (balanceHistory && balanceHistory.length > 0) {
          const dayBalances = balanceHistory.filter(
            (b) => {
              const ts = new Date(b.timestamp);
              return ts >= dayStart && ts <= dayEnd;
            }
          );
          if (dayBalances.length > 0) {
            openingBalance = Number(dayBalances[0].account_value || 0);
          } else if (i > 0 && dataPoints[i - 1]) {
            openingBalance = dataPoints[i - 1].closingBalance;
          }
        }

        // Find closing balance (last record of the day)
        let closingBalance = openingBalance;
        if (balanceHistory && balanceHistory.length > 0) {
          const dayBalances = balanceHistory.filter(
            (b) => {
              const ts = new Date(b.timestamp);
              return ts >= dayStart && ts <= dayEnd;
            }
          );
          if (dayBalances.length > 0) {
            closingBalance = Number(dayBalances[dayBalances.length - 1].account_value || 0);
          }
        }

        // Calculate gains/losses for the day
        let gains = 0;
        let losses = 0;
        if (activities && activities.length > 0) {
          const dayActivities = activities.filter(
            (a) => {
              const ts = new Date(a.timestamp);
              return ts >= dayStart && ts <= dayEnd;
            }
          );
          for (const activity of dayActivities) {
            const amount = Number(activity.amount || 0);
            if (amount > 0) {
              gains += amount;
            } else if (amount < 0) {
              losses += Math.abs(amount);
            }
          }
        }

        dataPoints.push({
          date: dayStart.toISOString(),
          openingBalance,
          closingBalance: closingBalance || openingBalance,
          gains,
          losses,
          periodLabel: dayNames[i],
        });
      }
    } else if (period === "month") {
      // Month: Last 5 weeks (Week 1 to Week 5 of current month)
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      // Get first Monday of the month or start of month
      const firstMonday = new Date(firstDayOfMonth);
      const firstDayOfWeek = firstMonday.getDay();
      const mondayOffset = firstDayOfWeek === 0 ? -6 : 1 - firstDayOfWeek;
      firstMonday.setDate(firstDayOfMonth.getDate() + mondayOffset);
      firstMonday.setHours(0, 0, 0, 0);
      
      startDate = firstMonday;

      // Get balance history for the month
      const { data: balanceHistoryData, error: balanceError } = await sb
        .from("wallet_balance_history")
        .select("account_value, timestamp")
        .gte("timestamp", startDate.toISOString())
        .lte("timestamp", lastDayOfMonth.toISOString())
        .order("timestamp", { ascending: true });

      if (balanceError) throw balanceError;

      // Get activities for the month
      const { data: activitiesData, error: activitiesError } = await sb
        .from("portfolio_activities")
        .select("type, amount, timestamp")
        .gte("timestamp", startDate.toISOString())
        .lte("timestamp", lastDayOfMonth.toISOString())
        .order("timestamp", { ascending: true });

      if (activitiesError) throw activitiesError;

      // Type the query results explicitly
      const balanceHistory: BalanceHistoryRecord[] = (balanceHistoryData || []) as BalanceHistoryRecord[];
      const activities: PortfolioActivityRecord[] = (activitiesData || []) as PortfolioActivityRecord[];

      // Group by week (5 weeks)
      for (let week = 0; week < 5; week++) {
        const weekStart = new Date(firstMonday);
        weekStart.setDate(firstMonday.getDate() + week * 7);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        // Don't go beyond end of month
        if (weekStart > lastDayOfMonth) break;

        // Find opening balance (first record of the week or previous week's closing)
        let openingBalance = 0;
        if (balanceHistory && balanceHistory.length > 0) {
          const weekBalances = balanceHistory.filter(
            (b) => {
              const ts = new Date(b.timestamp);
              return ts >= weekStart && ts <= weekEnd;
            }
          );
          if (weekBalances.length > 0) {
            openingBalance = Number(weekBalances[0].account_value || 0);
          } else if (week > 0 && dataPoints[week - 1]) {
            openingBalance = dataPoints[week - 1].closingBalance;
          }
        }

        // Find closing balance (last record of the week)
        let closingBalance = openingBalance;
        if (balanceHistory && balanceHistory.length > 0) {
          const weekBalances = balanceHistory.filter(
            (b) => {
              const ts = new Date(b.timestamp);
              return ts >= weekStart && ts <= weekEnd;
            }
          );
          if (weekBalances.length > 0) {
            closingBalance = Number(weekBalances[weekBalances.length - 1].account_value || 0);
          }
        }

        // Calculate gains/losses for the week
        let gains = 0;
        let losses = 0;
        if (activities && activities.length > 0) {
          const weekActivities = activities.filter(
            (a) => {
              const ts = new Date(a.timestamp);
              return ts >= weekStart && ts <= weekEnd;
            }
          );
          for (const activity of weekActivities) {
            const amount = Number(activity.amount || 0);
            if (amount > 0) {
              gains += amount;
            } else if (amount < 0) {
              losses += Math.abs(amount);
            }
          }
        }

        dataPoints.push({
          date: weekStart.toISOString(),
          openingBalance,
          closingBalance: closingBalance || openingBalance,
          gains,
          losses,
          periodLabel: `Week ${week + 1}`,
        });
      }
    } else {
      // Year: Last 12 months (January to December)
      const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      startDate = twelveMonthsAgo;

      // Get balance history for last 12 months
      const { data: balanceHistoryData, error: balanceError } = await sb
        .from("wallet_balance_history")
        .select("account_value, timestamp")
        .gte("timestamp", startDate.toISOString())
        .order("timestamp", { ascending: true });

      if (balanceError) throw balanceError;

      // Get activities for last 12 months
      const { data: activitiesData, error: activitiesError } = await sb
        .from("portfolio_activities")
        .select("type, amount, timestamp")
        .gte("timestamp", startDate.toISOString())
        .order("timestamp", { ascending: true });

      if (activitiesError) throw activitiesError;

      // Type the query results explicitly
      const balanceHistory: BalanceHistoryRecord[] = (balanceHistoryData || []) as BalanceHistoryRecord[];
      const activities: PortfolioActivityRecord[] = (activitiesData || []) as PortfolioActivityRecord[];

      // Group by month
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      
      for (let i = 11; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
        monthStart.setHours(0, 0, 0, 0);
        const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
        monthEnd.setHours(23, 59, 59, 999);

        // Find opening balance (first record of the month or previous month's closing)
        let openingBalance = 0;
        if (balanceHistory && balanceHistory.length > 0) {
          const monthBalances = balanceHistory.filter(
            (b) => {
              const ts = new Date(b.timestamp);
              return ts >= monthStart && ts <= monthEnd;
            }
          );
          if (monthBalances.length > 0) {
            openingBalance = Number(monthBalances[0].account_value || 0);
          } else if (dataPoints.length > 0) {
            openingBalance = dataPoints[dataPoints.length - 1].closingBalance;
          }
        }

        // Find closing balance (last record of the month)
        let closingBalance = openingBalance;
        if (balanceHistory && balanceHistory.length > 0) {
          const monthBalances = balanceHistory.filter(
            (b) => {
              const ts = new Date(b.timestamp);
              return ts >= monthStart && ts <= monthEnd;
            }
          );
          if (monthBalances.length > 0) {
            closingBalance = Number(monthBalances[monthBalances.length - 1].account_value || 0);
          }
        }

        // Calculate gains/losses for the month
        let gains = 0;
        let losses = 0;
        if (activities && activities.length > 0) {
          const monthActivities = activities.filter(
            (a) => {
              const ts = new Date(a.timestamp);
              return ts >= monthStart && ts <= monthEnd;
            }
          );
          for (const activity of monthActivities) {
            const amount = Number(activity.amount || 0);
            if (amount > 0) {
              gains += amount;
            } else if (amount < 0) {
              losses += Math.abs(amount);
            }
          }
        }

        dataPoints.push({
          date: monthStart.toISOString(),
          openingBalance,
          closingBalance: closingBalance || openingBalance,
          gains,
          losses,
          periodLabel: monthNames[monthDate.getMonth()],
        });
      }
    }

    return NextResponse.json({
      periodData: dataPoints,
      period,
      totalPoints: dataPoints.length,
    });
  } catch (error: any) {
    console.error("Error in period-based account value API:", error);
    return NextResponse.json(
      {
        error: error?.message || "Failed to fetch period-based account value data",
        periodData: [],
      },
      { status: 500 }
    );
  }
}

