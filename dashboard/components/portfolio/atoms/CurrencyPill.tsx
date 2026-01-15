type CurrencyPillProps = {
  code: string;
  value: string;
  colorClass: string; // e.g. bg-emerald-100 text-emerald-700
};

export function CurrencyPill({ code, value, colorClass }: CurrencyPillProps) {
  return (
    <div className="rounded-xl bg-white p-3 ring-1 ring-black/10">
      <div className="flex items-center gap-2">
        <div className={`h-7 w-7 grid place-items-center rounded-full text-xs font-semibold ${colorClass}`}>{code[0]}</div>
        <div>
          <div className="text-slate-700 text-xs">{code}</div>
          <div className="text-slate-900 font-semibold text-sm">{value}</div>
        </div>
      </div>
    </div>
  );
}


