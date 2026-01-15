"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

const items = [
  { href: "/", label: "Dashboard" },
  { href: "#positions", label: "Positions" },
  { href: "#orders", label: "Orders" },
  { href: "#decisions", label: "AI Decisions" },
  { href: "#logs", label: "Logs" },
];

export function Sidebar({ className }: { className?: string }) {
  return (
    <aside className={cn("glass sticky top-6 h-[calc(100vh-3rem)] w-64 rounded-2xl p-4 text-sm hidden lg:flex flex-col", className)}>
      <div className="mb-4 flex items-center justify-between">
        <div className="font-semibold tracking-tight">AYO Trader</div>
        <Badge variant="outline">Beta</Badge>
      </div>
      <Separator className="mb-3" />
      <nav className="space-y-1">
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className="flex items-center justify-between rounded-xl px-3 py-2 text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            {it.label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto pt-4">
        <Separator className="mb-3" />
        <div className="rounded-xl bg-white/5 p-3 text-xs text-slate-300">
          Track, trade and monitor in real‑time.
        </div>
      </div>
    </aside>
  );
}
