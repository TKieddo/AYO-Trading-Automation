import { DecisionsFeed } from "@/components/dashboard/DecisionsFeed";

interface RightSidebarProps {
  nftImage?: React.ReactNode;
  progressValue?: number;
  progressLabel?: string;
}

export function RightSidebar({
  nftImage,
  progressValue = 60,
  progressLabel = "WETH/USDC"
}: RightSidebarProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* AI Decisions */}
      <div className="rounded-xl">
        <DecisionsFeed />
      </div>
    </div>
  );
}
