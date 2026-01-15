"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export function ScrollTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      aria-label="Scroll to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-6 right-6 z-50 inline-flex items-center justify-center w-11 h-11 rounded-full shadow-lg bg-gradient-to-br from-[#d9f08f] via-[#c0e156] to-[#9cc32a] text-slate-900 hover:brightness-95"
    >
      <ArrowUp className="w-5 h-5" />
    </button>
  );
}


