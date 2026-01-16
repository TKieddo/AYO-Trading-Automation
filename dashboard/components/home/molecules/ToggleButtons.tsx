"use client";

interface ToggleButtonsProps<T extends string> {
  options: T[];
  selected: T;
  onSelect: (value: T) => void;
}

export function ToggleButtons<T extends string>({ 
  options, 
  selected, 
  onSelect 
}: ToggleButtonsProps<T>) {
  return (
    <div className="flex gap-1 bg-black/30 border border-lime-400/20 rounded-md p-0.5">
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onSelect(option)}
          className={`flex-1 px-2 py-1 rounded-sm text-xs font-medium transition-colors ${
            selected === option
              ? "bg-lime-400 text-black shadow-sm"
              : "text-lime-300/70 hover:text-lime-400"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
