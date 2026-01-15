import { ArrowDownRight, ArrowUpRight } from "lucide-react";

export function SidePill({ side }: { side: "buy" | "sell" }) {
  const isBuy = side === "buy";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
        isBuy
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
          : "bg-red-50 text-red-700 ring-1 ring-red-200"
      }`}
    >
      {side.toUpperCase()} {isBuy ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
    </span>
  );
}

export function StatusPill({ status }: { status: "open" | "filled" | "canceled" | "rejected" | "triggered" }) {
  const styles =
    status === "open"
      ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
      : status === "filled"
      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
      : status === "canceled"
      ? "bg-slate-100 text-slate-700 ring-1 ring-slate-200"
      : status === "triggered"
      ? "bg-purple-50 text-purple-700 ring-1 ring-purple-200"
      : "bg-red-50 text-red-700 ring-1 ring-red-200"; // rejected
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${styles}`}>{status}</span>;
}


