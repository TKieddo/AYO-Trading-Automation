"use client";

import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";

export function Topbar() {
  const pathname = usePathname();
  const isHistory = pathname === "/history";
  const isDashboard = pathname === "/";
  const isPortfolio = pathname === "/portfolio";
  const isCharts = pathname === "/charts";
  const isSettings = pathname === "/settings";
  return (
    <div className="mb-4 rounded-2xl px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Image src="/Ayo-logo.jpg" alt="Logo" width={40} height={40} className="rounded-full ring-1 ring-slate-200 bg-white shrink-0" />
          <div className="relative flex-1 min-w-0">
            <input
              placeholder="Search"
              className="w-full rounded-xl bg-white px-4 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none ring-1 ring-black/10 focus:ring-black/20"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ConnectionStatus compact />
          <Button
            asChild
            variant={isDashboard ? "default" : "secondary"}
            size="sm"
            className={isDashboard ? "bg-gradient-to-br from-[#d9f08f] via-[#c0e156] to-[#9cc32a] text-slate-900 hover:brightness-95" : undefined}
          >
            <Link href="/">Dashboard</Link>
          </Button>
          <Button
            asChild
            variant={isHistory ? "default" : "ghost"}
            size="sm"
            className={(isHistory ? "bg-gradient-to-br from-[#d9f08f] via-[#c0e156] to-[#9cc32a] text-slate-900 hover:brightness-95 " : "") + "border border-slate-300 text-slate-700 bg-transparent hover:bg-slate-50"}
          >
            <Link href="/history">History</Link>
          </Button>
          <Button
            asChild
            variant={isPortfolio ? "default" : "ghost"}
            size="sm"
            className={(isPortfolio ? "bg-gradient-to-br from-[#d9f08f] via-[#c0e156] to-[#9cc32a] text-slate-900 hover:brightness-95 " : "") + "border border-slate-300 text-slate-700 bg-transparent hover:bg-slate-50"}
          >
            <Link href="/portfolio">Portfolio</Link>
          </Button>
          <Button
            asChild
            variant={isCharts ? "default" : "ghost"}
            size="sm"
            className={(isCharts ? "bg-gradient-to-br from-[#d9f08f] via-[#c0e156] to-[#9cc32a] text-slate-900 hover:brightness-95 " : "") + "border border-slate-300 text-slate-700 bg-transparent hover:bg-slate-50"}
          >
            <Link href="/charts">Charts</Link>
          </Button>
          <Button
            asChild
            variant={isSettings ? "default" : "ghost"}
            size="sm"
            className={(isSettings ? "bg-gradient-to-br from-[#d9f08f] via-[#c0e156] to-[#9cc32a] text-slate-900 hover:brightness-95 " : "") + "border border-slate-300 text-slate-700 bg-transparent hover:bg-slate-50"}
          >
            <Link href="/settings">Settings</Link>
          </Button>
          <Avatar />
        </div>
      </div>
    </div>
  );
}
