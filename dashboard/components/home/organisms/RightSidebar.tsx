import { CircularProgress } from "../atoms/CircularProgress";
import { Badge } from "../atoms/Badge";

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
      {/* NFT Card */}
      <div className="rounded-xl bg-gray-800 p-4">
        <div className="w-full h-32 bg-gray-700 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
          {nftImage || (
            <div className="w-24 h-24 bg-gradient-to-br from-gray-600 to-gray-800 rounded-full flex items-center justify-center">
              <svg className="w-16 h-16 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Badge variant="gray" className="flex items-center gap-1 text-xs">
            Nft
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Badge>
          <Badge variant="gray" className="flex items-center gap-1 text-xs">
            Portfolio
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </Badge>
        </div>
      </div>

      {/* Circular Progress Chart */}
      <div className="rounded-xl bg-gray-800 p-4 flex flex-col items-center">
        <CircularProgress 
          value={progressValue} 
          label={progressLabel}
          size={100}
        />
      </div>
    </div>
  );
}
