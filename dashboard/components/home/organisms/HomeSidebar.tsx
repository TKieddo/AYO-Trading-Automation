"use client";

import Link from "next/link";
import { NavIcon } from "../atoms/NavIcon";
import { Logo } from "../atoms/Logo";

export function HomeSidebar() {
  return (
    <aside className="w-20 bg-black border-r border-gray-800 flex flex-col items-center py-6">
      {/* Logo at top */}
      <div className="mb-8">
        <Logo size={40} />
      </div>

      {/* Navigation icons */}
      <nav className="flex-1 flex flex-col gap-4">
        {/* Active icon (Home) */}
        <NavIcon href="/" isActive>
          <div className="w-6 h-6 grid grid-cols-2 gap-0.5">
            <div className="w-2.5 h-2.5 bg-black rounded-sm"></div>
            <div className="w-2.5 h-2.5 bg-black rounded-sm"></div>
            <div className="w-2.5 h-2.5 bg-black rounded-sm"></div>
            <div className="w-2.5 h-2.5 bg-black rounded-sm"></div>
          </div>
        </NavIcon>

        {/* Dashboard icon */}
        <NavIcon href="/dashboard">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </NavIcon>

        <NavIcon>
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </NavIcon>

        <NavIcon>
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
          </svg>
        </NavIcon>

        <NavIcon>
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </NavIcon>
      </nav>

      {/* Bottom section */}
      <div className="mt-auto flex flex-col gap-4">
        <NavIcon>
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
          </svg>
        </NavIcon>

        {/* Profile image */}
        <div className="w-12 h-12 rounded-full border-2 border-yellow-400 overflow-hidden">
          <div className="w-full h-full bg-gray-700 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>
    </aside>
  );
}
