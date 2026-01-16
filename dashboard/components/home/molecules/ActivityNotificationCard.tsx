import { ReactNode } from "react";

interface ActivityNotificationCardProps {
  icon: ReactNode;
  date: string;
  avatar?: ReactNode;
  title: string;
  amount?: string;
  variant?: "default" | "payment";
}

export function ActivityNotificationCard({
  icon,
  date,
  avatar,
  title,
  amount,
  variant = "default"
}: ActivityNotificationCardProps) {
  return (
    <div className="bg-yellow-400 rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
            {icon}
          </div>
          <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <span className="text-gray-600 text-xs">{date}</span>
      </div>
      {avatar && (
        <div className="mb-3">
          {avatar}
        </div>
      )}
      <p className="text-black font-medium mb-2">{title}</p>
      {amount && (
        <p className="text-black text-3xl font-bold">{amount}</p>
      )}
    </div>
  );
}
