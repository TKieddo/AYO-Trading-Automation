import { CircularProgress } from "../atoms/CircularProgress";
import { Badge } from "../atoms/Badge";
import { ActivityNotificationCard } from "../molecules/ActivityNotificationCard";

interface RightColumnProps {
  nftImage?: React.ReactNode;
  progressValue?: number;
  progressLabel?: string;
  activityChartData?: {
    data: number[];
    labels: string[];
    maxValue: string;
    title: string;
  };
  notifications?: Array<{
    icon: React.ReactNode;
    date: string;
    avatar?: React.ReactNode;
    title: string;
    amount?: string;
    variant?: "default" | "payment";
  }>;
}

export function RightColumn({
  nftImage,
  progressValue = 60,
  progressLabel = "WETH/USDC",
  activityChartData,
  notifications = []
}: RightColumnProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* NFT Card */}
      <div className="rounded-2xl bg-gray-900 p-6">
        <div className="w-full h-48 bg-gray-800 rounded-xl mb-4 flex items-center justify-center overflow-hidden">
          {nftImage || (
            <div className="w-32 h-32 bg-gradient-to-br from-gray-700 to-gray-900 rounded-full flex items-center justify-center">
              <svg className="w-20 h-20 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Badge variant="gray" className="flex items-center gap-1">
            Nft
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Badge>
          <Badge variant="gray" className="flex items-center gap-1">
            Portfolio
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </Badge>
        </div>
      </div>

      {/* Circular Progress Chart */}
      <div className="rounded-2xl bg-gray-900 p-6 flex flex-col items-center">
        <CircularProgress value={progressValue} label={progressLabel} />
      </div>

      {/* Activity Section - Removed incompatible props */}
      {/* Note: ActivitySection now expects cryptoData and forexData props, not chartData and notifications */}

      {/* Activity Notifications */}
      {notifications.length > 0 && (
        <div className="rounded-2xl bg-gray-900 p-6 space-y-4">
          {notifications.map((notification, index) => (
            <ActivityNotificationCard
              key={index}
              icon={notification.icon}
              date={notification.date}
              avatar={notification.avatar}
              title={notification.title}
              amount={notification.amount}
              variant={notification.variant}
            />
          ))}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
              Details
            </button>
            <button className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
              Docs
            </button>
            <button className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
              Notes
            </button>
          </div>

          {/* Arrow Icon */}
          <div className="flex justify-end">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
