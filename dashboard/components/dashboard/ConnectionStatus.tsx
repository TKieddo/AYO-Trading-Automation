"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Wifi, WifiOff, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConnectionStatus {
  connected: boolean;
  network?: string;
  wallet?: string;
  balance?: number;
  lastCheck?: string;
  error?: string;
}

export function ConnectionStatus({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<ConnectionStatus>({ connected: false });
  const [checking, setChecking] = useState(false);

  const checkConnection = async () => {
    setChecking(true);
    try {
      // Fetch from unified status endpoint
      const response = await fetch("/api/agent/status", { 
        method: "GET", 
        cache: "no-store",
        headers: {
          "Cache-Control": "no-store",
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        // Check if connected based on response
        const isConnected = data.connected === true || data.status === 'online';
        
        setStatus({
          connected: isConnected,
          network: data.network || data.network_label || data.exchange || "mainnet",
          wallet: data.wallet,
          balance: data.balance || data.account_value,
          lastCheck: data.timestamp || new Date().toISOString(),
          error: data.error,
        });
      } else {
        // Response not ok - try to get error message
        const errorData = await response.json().catch(() => ({} as any));
        setStatus({ 
          connected: false,
          error: errorData.error || `Server returned ${response.status}`,
          lastCheck: new Date().toISOString(),
        });
      }
    } catch (error: any) {
      // Handle network errors, timeouts, etc.
      console.error("Connection check error:", error);
      
      setStatus({ 
        connected: false,
        error: error.message || "Network error",
        lastCheck: new Date().toISOString(),
      });
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 30000); // Check every 30s
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // checkConnection is stable, doesn't need to be in deps

  if (compact) {
    return (
      <button
        onClick={checkConnection}
        disabled={checking}
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs transition-colors",
          "hover:opacity-80 disabled:opacity-50",
          status.connected ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
        )}
        title={
          status.connected 
            ? `Connected to ${status.network || "mainnet"}${status.balance ? ` - Balance: $${status.balance.toFixed(2)}` : ""}` 
            : status.error 
              ? `Offline: ${status.error}` 
              : "Python agent offline - Click to check"
        }
      >
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            status.connected ? "bg-emerald-500" : "bg-red-500",
            checking && "animate-pulse"
          )}
        />
        {status.connected ? (status.network || "mainnet") : "offline"}
        {checking && (
          <span className="ml-1 h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
        )}
      </button>
    );
  }

  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                status.connected ? "bg-emerald-500" : "bg-red-500"
              )}
            />
            <span className="font-medium">{status.connected ? "Connected" : "Disconnected"}</span>
            <span className="text-slate-500">
              {status.connected ? (status.network || "mainnet") : ""}
            </span>
          </div>
          <button
            onClick={checkConnection}
            disabled={checking}
            className={cn(
              "p-1.5 rounded-md transition-colors hover:bg-slate-100 disabled:opacity-50"
            )}
            title="Refresh"
          >
            <Wifi className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

