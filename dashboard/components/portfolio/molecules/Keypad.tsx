type KeypadProps = {
  onPress?: (value: string) => void;
};

const keys = [
  "1","2","3",
  "4","5","6",
  "7","8","9",
  "0"
];

export function Keypad({ onPress }: KeypadProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {keys.slice(0,9).map(k => (
        <button
          key={k}
          className="h-12 rounded-xl bg-white text-slate-800 ring-1 ring-black/10 hover:bg-slate-50"
          onClick={() => onPress?.(k)}
        >{k}</button>
      ))}
      <div />
      <button className="h-12 rounded-xl bg-white text-slate-800 ring-1 ring-black/10 hover:bg-slate-50" onClick={() => onPress?.("0")}>0</button>
      <div />
    </div>
  );
}


