import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Keypad } from "@/components/portfolio/molecules/Keypad";

type TransferPanelProps = {
  name: string;
  last4: string;
  amount: string;
};

export function TransferPanel({ name, last4, amount }: TransferPanelProps) {
  return (
    <Card className="p-6 sticky top-4 ring-1 ring-black/10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-full overflow-hidden">
            <Image src="https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=80&q=80&auto=format&fit=crop" alt={name} width={36} height={36} />
          </div>
          <div>
            <div className="text-slate-900 font-semibold">{name}</div>
            <div className="text-slate-500 text-xs">**** {last4}</div>
          </div>
        </div>
        <div className="rounded-full bg-black text-white text-xs px-3 py-1">**** 2872 ▾</div>
      </div>

      <div className="text-5xl font-extrabold text-slate-900">{amount}</div>
      <div className="text-slate-500 text-sm">Balance: $126,887.09</div>

      <div className="mt-6 grid grid-cols-2 gap-y-2 text-sm text-slate-600">
        <div>Exchange rate</div><div className="text-right">1 USD = 0.95 EUR</div>
        <div>Balance after transfer</div><div className="text-right">$124,785.39</div>
        <div>Transaction fee</div><div className="text-right">$0.00 (free transfer)</div>
      </div>

      <div className="mt-4">
        <input placeholder="Note" className="w-full rounded-xl bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none ring-1 ring-black/10" />
      </div>

      <div className="mt-4">
        <Keypad />
      </div>

      <button className="mt-6 w-full rounded-full bg-black text-white py-3 text-sm font-semibold">Send</button>
    </Card>
  );
}


