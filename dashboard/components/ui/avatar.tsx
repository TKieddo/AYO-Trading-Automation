import * as React from "react";
import { cn } from "@/lib/utils";

export function Avatar({ src, alt, className }: { src?: string; alt?: string; className?: string }) {
  return (
    <div className={cn("h-9 w-9 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-white/10 to-white/5" />)
      }
    </div>
  );
}
