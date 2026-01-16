interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "gray";
  className?: string;
}

export function Badge({ children, variant = "default", className = "" }: BadgeProps) {
  const baseClasses = "px-2 py-1 rounded-full text-xs";
  const variantClasses = variant === "gray" 
    ? "bg-gray-700 text-white" 
    : "bg-gray-800 text-white";
  
  return (
    <span className={`${baseClasses} ${variantClasses} ${className}`}>
      {children}
    </span>
  );
}
