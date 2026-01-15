import { Transaction, TransactionItem } from "@/components/portfolio/molecules/TransactionItem";

type RecentTransactionsProps = {
  items: Transaction[];
};

export function RecentTransactions({ items }: RecentTransactionsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-slate-800 font-semibold">Recent Transactions</h3>
        <button className="text-slate-500 text-sm hover:text-slate-700">View All</button>
      </div>
      <div className="space-y-3">
        {items.map((tx) => (
          <TransactionItem key={tx.id} tx={tx} />
        ))}
      </div>
    </div>
  );
}


