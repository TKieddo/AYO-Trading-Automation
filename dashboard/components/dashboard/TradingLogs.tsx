"use client";

import { useEffect, useState, useRef } from "react";
import { Info, AlertTriangle, XCircle, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/utils";
import type { TradingLog } from "@/lib/types";

const levelConfig = {
  info: {
    icon: Info,
    className: "text-blue-300",
  },
  warning: {
    icon: AlertTriangle,
    className: "text-yellow-300",
  },
  error: {
    icon: XCircle,
    className: "text-red-300",
  },
  success: {
    icon: CheckCircle,
    className: "text-emerald-300",
  },
};

export function TradingLogs() {
  const [logs, setLogs] = useState<TradingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await fetch("/api/logs?limit=50");
        if (response.ok) {
          const data = await response.json();
          setLogs(data);
        }
      } catch (error) {
        console.error("Failed to fetch logs:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 2000); // Update every 2s

    return () => clearInterval(interval);
  }, []);

  // Check if user scrolled up (disable auto-scroll)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      // If user scrolled up more than 100px from bottom, disable auto-scroll
      shouldAutoScroll.current = scrollHeight - scrollTop - clientHeight < 100;
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-scroll to bottom on new logs (only within container, only if user is near bottom)
  useEffect(() => {
    if (!shouldAutoScroll.current || !containerRef.current || !bottomRef.current) return;

    const container = containerRef.current;
    // Scroll container to bottom, not the whole page
    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, [logs]);

  if (loading) {
    return (
      <Card className="bg-black text-white rounded-[20px]">
        <CardHeader className="py-3">
          <CardTitle className="text-[14px] text-white/80">Trading Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 rounded bg-white/10"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-black text-white rounded-[20px]">
      <CardHeader className="py-3">
        <CardTitle className="text-[14px] text-white/80">Trading Logs</CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={containerRef} className="max-h-[400px] overflow-y-auto rounded-xl ring-1 ring-white/10 bg-white/5">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-white/60">No logs yet</div>
          ) : (
            <div className="divide-y divide-white/10">
              {logs.map((log) => {
                const config = levelConfig[log.level];
                const Icon = config.icon;

                return (
                  <div key={log.id} className="flex items-start gap-3 p-3 hover:bg-white/10 transition-colors">
                    <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${config.className}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-white break-words">{log.message}</p>
                        <span className="text-xs text-white/50 flex-shrink-0">{formatRelativeTime(log.timestamp)}</span>
                      </div>
                      {log.data && (
                        <pre className="mt-1 text-xs text-white/70 overflow-x-auto">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </CardContent>
    </Card>
  );
}

