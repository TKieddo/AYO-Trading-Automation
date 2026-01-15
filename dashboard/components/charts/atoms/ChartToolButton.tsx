import { ReactNode } from "react";

type ChartToolButtonProps = {
  children: ReactNode;
  onClick?: () => void;
};

export function ChartToolButton({ children, onClick }: ChartToolButtonProps) {
  return (
    <button
      onClick={onClick}
      className="w-7 h-7 flex items-center justify-center text-[#AAAAAA] hover:text-[#1A1A1A] rounded transition-colors"
      aria-label="Chart tool"
    >
      {children}
    </button>
  );
}

