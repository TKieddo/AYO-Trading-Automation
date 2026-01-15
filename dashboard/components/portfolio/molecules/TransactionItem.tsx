import Image from "next/image";
import { AmountDelta } from "@/components/portfolio/atoms/AmountDelta";

export type Transaction = {
  id: string;
  title: string;
  subtitle: string;
  avatarUrl: string; // unsplash or brand logo
  amount: number; // positive/negative
};

type TransactionItemProps = {
  tx: Transaction;
};

export function TransactionItem({ tx }: TransactionItemProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-black/10">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-10 w-10 rounded-full overflow-hidden ring-1 ring-black/10 shrink-0 bg-white">
          <Image src={tx.avatarUrl} alt={tx.title} width={40} height={40} className="h-10 w-10 object-cover" />
        </div>
        <div className="min-w-0">
          <div className="text-slate-900 font-medium truncate">{tx.title}</div>
          <div className="text-slate-500 text-xs">{tx.subtitle}</div>
        </div>
      </div>
      <AmountDelta value={tx.amount} />
    </div>
  );
}


