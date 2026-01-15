"use client";

import Link from "next/link";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";

export function Footer() {
  return (
    <footer className="mt-8">
      <div className="rounded-2xl ring-1 ring-slate-200 bg-white/60 backdrop-blur px-4 sm:px-6">
        <div className="flex items-center justify-between py-3 text-sm text-slate-600">
        <div className="flex items-center gap-3">
          <ConnectionStatus compact />
        </div>
          <nav className="flex items-center gap-6">
          <Link href="/trading" className="hover:text-slate-800 font-medium">Trading</Link>
          <Link href="/wallet" className="hover:text-slate-800">Wallet</Link>
          <Link href="/disclaimer" className="hover:text-slate-800">Disclaimer</Link>
          <Link href="/terms" className="hover:text-slate-700">Terms</Link>
          <Link href="/privacy" className="hover:text-slate-700">Privacy Policy</Link>
          <Link href="/about" className="hover:text-slate-700">About</Link>
          <Link href="/risk" className="hover:text-slate-700">Risk Notice</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}


