import clsx from "clsx";

type AmountDeltaProps = {
  value: number; // positive for income, negative for expense
  className?: string;
};

export function AmountDelta({ value, className }: AmountDeltaProps) {
  const isPositive = value >= 0;
  const sign = isPositive ? "+" : "-";
  const formatted = Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return (
    <span
      className={clsx(
        "text-sm font-semibold",
        isPositive ? "text-emerald-600" : "text-rose-600",
        className
      )}
    >
      {sign}${formatted}
    </span>
  );
}


