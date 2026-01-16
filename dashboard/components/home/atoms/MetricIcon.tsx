import { ReactNode } from "react";

interface MetricIconProps {
  children: ReactNode;
  variant?: "yellow" | "white";
  size?: number;
}

export function MetricIcon({ children, variant = "white", size = 40 }: MetricIconProps) {
  const bgColor = variant === "yellow" ? "bg-yellow-400" : "bg-white";
  const textColor = variant === "yellow" ? "text-black" : "text-black";
  
  return (
    <div 
      className={`${bgColor} ${textColor} rounded-full flex items-center justify-center`}
      style={{ width: size, height: size }}
    >
      {children}
    </div>
  );
}
