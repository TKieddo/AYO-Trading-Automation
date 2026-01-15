"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Send, Zap, XCircle, ShieldCheck, RefreshCw, Crown } from "lucide-react";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

export function AiChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Disabled auto-scroll to avoid jumping after each send
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const append = (m: ChatMessage) => setMessages((prev) => [...prev, m]);

  const handleSend = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content) return;
    setSending(true);
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };
    append(userMsg);
    setInput("");

    try {
      // Placeholder AI call: try status first; adapt to your AI route when ready
      const res = await fetch("/api/trading/status", { method: "POST" });
      let reply = "Acknowledged.";
      if (res.ok) {
        const data = await res.json();
        reply = `Status: balance ${data?.data?.balance ?? "--"}, positions ${data?.data?.positions ?? "--"}.`;
      }
      const botMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: reply,
        timestamp: new Date().toISOString(),
      };
      append(botMsg);
    } catch (e: any) {
      append({
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Error: ${e?.message ?? "Failed to reach agent"}`,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setSending(false);
    }
  };

  const shortcuts = [
    {
      label: "Status",
      icon: ShieldCheck,
      onClick: async () => {
        append({ id: crypto.randomUUID(), role: "user", content: "Check status", timestamp: new Date().toISOString() });
        await handleSend("Check status");
      },
    },
    {
      label: "Cancel All",
      icon: XCircle,
      onClick: async () => {
        append({ id: crypto.randomUUID(), role: "user", content: "Cancel all orders", timestamp: new Date().toISOString() });
        try {
          const res = await fetch("/api/trading/cancel_all", { method: "POST" });
          const data = await res.json();
          append({ id: crypto.randomUUID(), role: "assistant", content: data?.message ?? "Cancelled.", timestamp: new Date().toISOString() });
        } catch (e: any) {
          append({ id: crypto.randomUUID(), role: "assistant", content: `Error: ${e?.message ?? "Failed"}`, timestamp: new Date().toISOString() });
        }
      },
    },
    {
      label: "Refresh",
      icon: RefreshCw,
      onClick: async () => {
        append({ id: crypto.randomUUID(), role: "user", content: "Refresh data", timestamp: new Date().toISOString() });
        await fetch("/api/trading/refresh", { method: "POST" }).catch(() => {});
        append({ id: crypto.randomUUID(), role: "assistant", content: "Refresh initiated.", timestamp: new Date().toISOString() });
      },
    },
    {
      label: "Market Buy",
      icon: Zap,
      onClick: async () => {
        append({ id: crypto.randomUUID(), role: "user", content: "Buy 0.001 BTC market", timestamp: new Date().toISOString() });
        try {
          const res = await fetch("/api/trading/order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ asset: "BTC", side: "buy", amount: 0.001, type: "market" }),
          });
          const data = await res.json();
          append({ id: crypto.randomUUID(), role: "assistant", content: data?.message ?? "Order placed.", timestamp: new Date().toISOString() });
        } catch (e: any) {
          append({ id: crypto.randomUUID(), role: "assistant", content: `Error: ${e?.message ?? "Failed"}`, timestamp: new Date().toISOString() });
        }
      },
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 border-2 border-slate-400 rounded-3xl px-8 pt-8 pb-6 min-h-[520px]">
      {/* Left: Conversation output */}
      <div className="lg:col-span-2">
        <div className="rounded-[20px] bg-white/90 text-slate-900 ring-1 ring-slate-200 h-[420px] flex flex-col">
          <div className="py-3 px-4 border-b border-slate-100">
            <div className="text-[15px] font-semibold text-slate-700 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-black text-white px-2 py-1 text-[11px]"><Crown className="w-3.5 h-3.5" /> AYO</span>
              <span className="text-slate-500 text-[12px]">Trade Agent</span>
            </div>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 pt-4 pb-1">
            <div className="relative">
              {/* Timeline vertical line */}
              <div className="absolute left-5 top-0 bottom-0 w-[2px] bg-slate-400 z-0" />
              {messages.length === 0 ? (
                <div className="ml-10 text-slate-400 text-sm font-normal py-3">Say hello to your trading agent. Ask for status, place orders, or close positions.</div>
              ) : (
                <div className="space-y-4">
                  {messages.map((m, idx) => {
                    const isUser = m.role === 'user';
                    const nodeIcon = isUser ? (
                      <div className="rounded-full bg-[#bfe052] flex items-center justify-center w-7 h-7 ring-2 ring-[#a7c63f]">
                        <ShieldCheck className="w-4 h-4 text-[#2e3a07]" />
                      </div>
                    ) : (
                      <div className="rounded-full bg-black flex items-center justify-center w-7 h-7 ring-2 ring-slate-700">
                        <Crown className="w-4 h-4 text-white" />
                      </div>
                    );
                    return (
                      <div
                        key={m.id}
                        className={`relative flex items-start ${isUser ? 'flex-row-reverse' : 'flex-row'} group`}
                      >
                        {/* Node */}
                        <div className={`z-10 shrink-0 mt-1 ${isUser ? 'ml-2' : 'mr-2'}`}>{nodeIcon}</div>
                        <div className={`flex-1 max-w-2xl ${isUser ? 'items-end' : 'items-start'} flex flex-col min-w-0`}>          
                          {/* Header: label + time */}
                          <div className={`mb-1 flex items-center ${isUser ? 'justify-end' : 'justify-start'} gap-2`}>
                            {isUser ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#bfe052] text-[#23260b] text-[10px] font-semibold">You</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black text-white text-[10px] font-medium">AYO</span>
                            )}
                            <span className="text-[10px] text-slate-400">{new Date(m.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          </div>
                          {/* Message body */}
                          <div className={`rounded-lg border ${isUser ? 'border-[#e2f2a7]' : 'border-slate-200'} px-3 py-2 ${isUser ? 'bg-white/80' : 'bg-slate-50'} shadow-sm text-[12px] leading-snug ${isUser ? 'text-slate-800 ml-auto' : 'text-slate-700 mr-auto'} whitespace-pre-line max-w-full w-fit break-words`}>
                            {m.content}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>
        </div>
      </div>

      {/* Right: Shortcuts + Input */}
      <div className="lg:col-span-1">
        <Card className="rounded-[20px] text-white h-[420px] flex flex-col ring-1 ring-[#accf52] bg-gradient-to-br from-[#d8ffac] via-[#bfe052] to-[#7bb111]">
          <CardHeader className="py-3">
            <CardTitle className="text-[14px] text-[#23260b]">Trade Assistant</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto pb-1">
            <div className="text-sm text-[#343b12] mb-3">
              Quick actions and prompts to command your trading agent.
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {shortcuts.map((s) => (
                <Button
                  key={s.label}
                  variant="secondary"
                  className="justify-start gap-2 bg-[#bfe052]/70 hover:bg-[#bfe052]/80 text-[#23260b] border-[#d7e7a5]"
                  onClick={s.onClick}
                >
                  <s.icon className="w-4 h-4" /> {s.label}
                </Button>
              ))}
            </div>
            <div className="text-xs text-[#476012]">
              Examples:
              <ul className="list-disc ml-4 mt-1 space-y-1">
                <li>"Close all BTC positions"</li>
                <li>"Set stop loss on ETH to 2%"</li>
                <li>"Show today performance"</li>
              </ul>
            </div>
          </CardContent>
          <div className="p-3 border-t border-[#bddc73] mt-auto">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Type a command..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="bg-white/40 border-[#bddc73] placeholder-[#476012] text-[#23260b] focus-visible:ring-[#a1c823]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <Button
                onClick={() => handleSend()}
                disabled={sending || input.trim().length === 0}
                className="bg-[#476012] text-[#e7f6be] hover:bg-[#56831e]"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}


