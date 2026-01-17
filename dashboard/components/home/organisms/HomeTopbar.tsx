"use client";

import Link from "next/link";
import Image from "next/image";

export function HomeTopbar() {
  return (
    <header className="h-14 md:h-16 bg-black/40 backdrop-blur-sm border-b border-lime-400/20 flex items-center justify-between px-3 md:px-6">
      {/* Left Section */}
      <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
        <Image 
          src="/AYO Light Logo.png" 
          alt="AYO Logo" 
          width={120} 
          height={40} 
          className="h-6 md:h-8 w-auto object-contain flex-shrink-0"
        />
        <span className="text-white font-medium hidden sm:inline">AYO</span>
        <div className="hidden md:flex items-center gap-2 md:gap-4">
          <Link href="/dashboard" className="px-3 md:px-4 py-1.5 border border-lime-400/30 rounded-full text-lime-300 text-xs md:text-sm flex items-center gap-1.5 md:gap-2 hover:bg-lime-400/10 transition-colors whitespace-nowrap">
            <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
            <span className="hidden lg:inline">Dashboard</span>
        </Link>
          <Link href="/portfolio" className="px-3 md:px-4 py-1.5 border border-lime-400/30 rounded-full text-lime-300 text-xs md:text-sm flex items-center gap-1.5 md:gap-2 hover:bg-lime-400/10 transition-colors whitespace-nowrap">
            <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
            <span className="hidden lg:inline">Portfolio</span>
        </Link>
          <Link href="/charts" className="px-3 md:px-4 py-1.5 border border-lime-400/30 rounded-full text-lime-300 text-xs md:text-sm flex items-center gap-1.5 md:gap-2 hover:bg-lime-400/10 transition-colors whitespace-nowrap">
            <svg className="w-3.5 h-3.5 md:w-4 md:h-4 text-lime-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <span className="hidden lg:inline">Trade</span>
          </Link>
        </div>
        {/* Mobile Menu Button */}
        <button className="md:hidden ml-auto px-2 py-1 border border-lime-400/30 rounded text-lime-300">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Right Section */}
      <div className="hidden md:flex items-center gap-4 flex-shrink-0">
        <span className="text-white text-sm">Hello Maurice</span>
        <div className="w-10 h-10 rounded-full border-2 border-lime-400 overflow-hidden">
          <div className="w-full h-full bg-slate-800 flex items-center justify-center">
            <svg className="w-6 h-6 text-lime-300" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>
    </header>
  );
}
