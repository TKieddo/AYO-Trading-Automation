import Link from "next/link";
import { ReactNode } from "react";

interface NavIconProps {
  href?: string;
  isActive?: boolean;
  children: ReactNode;
  onClick?: () => void;
}

export function NavIcon({ href, isActive = false, children, onClick }: NavIconProps) {
  const baseClasses = "w-12 h-12 rounded-lg flex items-center justify-center transition-colors";
  const activeClasses = isActive ? "bg-yellow-400" : "bg-gray-800 hover:bg-gray-700";
  
  const content = (
    <div className={`${baseClasses} ${activeClasses}`}>
      {children}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  if (onClick) {
    return <button onClick={onClick} className="border-none bg-transparent p-0">{content}</button>;
  }

  return content;
}
