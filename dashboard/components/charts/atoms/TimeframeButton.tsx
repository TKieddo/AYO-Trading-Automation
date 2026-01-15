type TimeframeButtonProps = {
  timeframe: string;
  isActive: boolean;
  onClick: () => void;
};

export function TimeframeButton({ timeframe, isActive, onClick }: TimeframeButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
        isActive
          ? "bg-[#1A1A1A] text-white"
          : "text-[#1A1A1A] bg-white/40 backdrop-blur-sm border border-white/60 hover:bg-white/60"
      }`}
    >
      {timeframe}
    </button>
  );
}

