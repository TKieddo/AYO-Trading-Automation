"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Video, Loader2, CheckCircle, AlertCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function StrategyLearning() {
  const [videoUrl, setVideoUrl] = useState("");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    strategy?: any;
  } | null>(null);

  const handleExtract = async () => {
    if (!videoUrl.trim()) {
      setResult({ success: false, message: "Please enter a video URL" });
      return;
    }

    setProcessing(true);
    setResult(null);

    try {
      const response = await fetch("/api/trading/learn-strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_url: videoUrl }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          success: true,
          message: "Strategy extracted successfully!",
          strategy: data.strategy,
        });
        setVideoUrl(""); // Clear input on success
      } else {
        setResult({
          success: false,
          message: data.error || "Failed to extract strategy",
        });
      }
    } catch (error: any) {
      setResult({
        success: false,
        message: error.message || "An error occurred",
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Video URL Input Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="w-5 h-5" />
            Learn Strategy from Video
          </CardTitle>
          <CardDescription>
            Paste a YouTube or video URL below, then click "Extract Strategy" to have our AI analyze the video and extract the trading strategy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="video-url" className="text-base font-medium">
              Video URL
            </Label>
            <Input
              id="video-url"
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && videoUrl.trim() && !processing) {
                  handleExtract();
                }
              }}
              disabled={processing}
              className="w-full text-base py-3"
            />
            <p className="text-xs text-slate-500">
              Supports YouTube, Vimeo, and direct video links. Paste your URL above and click the button below.
            </p>
          </div>

          <div className="space-y-2">
            {videoUrl.trim() && !processing && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <p className="text-sm text-emerald-700 font-medium flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  URL entered! Ready to extract strategy.
                </p>
              </div>
            )}
            <Button
              onClick={handleExtract}
              disabled={processing || !videoUrl.trim()}
              size="lg"
              className={cn(
                "w-full text-base font-semibold py-6 shadow-lg transition-all",
                videoUrl.trim() && !processing
                  ? "bg-gradient-to-br from-[#d9f08f] via-[#c0e156] to-[#9cc32a] text-slate-900 hover:brightness-95 hover:scale-[1.02] cursor-pointer"
                  : "bg-slate-300 text-slate-500 cursor-not-allowed"
              )}
            >
              {processing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Processing Video...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Extract Strategy from Video
                </>
              )}
            </Button>
            {!videoUrl.trim() && (
              <p className="text-xs text-center text-slate-400">
                ⬆️ Enter a video URL above to enable this button
              </p>
            )}
          </div>

          {result && (
            <div
              className={cn(
                "flex items-start gap-3 p-4 rounded-lg",
                result.success
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              )}
            >
              {result.success ? (
                <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1">
                <p className="font-medium">{result.message}</p>
                {result.success && result.strategy && (
                  <div className="mt-3 text-sm">
                    <p className="font-semibold mb-1">Strategy: {result.strategy.name}</p>
                    {result.strategy.description && (
                      <p className="text-emerald-600">{result.strategy.description}</p>
                    )}
                    <p className="mt-2 text-emerald-600">
                      ✅ Strategy saved! You can now backtest it in the Strategy Library.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Start Guide */}
      <Card className="border-2 border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="text-blue-900">📋 Quick Start Guide</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <span className="font-bold text-blue-600 text-lg">1.</span>
              <div>
                <p className="font-medium text-slate-900">Paste Video URL</p>
                <p className="text-slate-600">Copy and paste a YouTube or video URL into the input field above</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="font-bold text-blue-600 text-lg">2.</span>
              <div>
                <p className="font-medium text-slate-900">Click "Extract Strategy"</p>
                <p className="text-slate-600">The green button will become enabled once you enter a URL. Click it to start!</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="font-bold text-blue-600 text-lg">3.</span>
              <div>
                <p className="font-medium text-slate-900">Wait for Processing</p>
                <p className="text-slate-600">AI will download, transcribe, and extract the strategy (this may take a few minutes)</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="font-bold text-blue-600 text-lg">4.</span>
              <div>
                <p className="font-medium text-slate-900">View in Strategy Library</p>
                <p className="text-slate-600">Once extracted, go to the "Strategy Library" tab to see your strategy and backtest it</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* How It Works Card */}
      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 list-decimal list-inside text-sm text-slate-600">
            <li>
              <span className="font-medium text-slate-900">Download & Transcribe</span> - We download the video and convert speech to text
            </li>
            <li>
              <span className="font-medium text-slate-900">Extract Strategy</span> - AI analyzes the transcript to identify trading rules, entry/exit conditions, and risk management
            </li>
            <li>
              <span className="font-medium text-slate-900">Generate Code</span> - AI converts the strategy into executable Python code
            </li>
            <li>
              <span className="font-medium text-slate-900">Ready to Backtest</span> - Strategy is saved and ready for backtesting
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

