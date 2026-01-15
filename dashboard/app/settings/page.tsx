import { TradingSettings } from "@/components/dashboard/TradingSettings";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Settings className="w-8 h-8 text-slate-700" />
          <h1 className="text-3xl font-bold text-slate-900">Trading Settings</h1>
        </div>
        <p className="text-slate-600">
          Configure your trading parameters, risk management, and execution settings. All changes are saved to the database and applied immediately.
        </p>
      </div>

      {/* Settings Sections */}
      <div className="space-y-6">
        {/* Trading Parameters Section */}
        <div>
          <h2 className="text-xl font-semibold text-slate-800 mb-4">Trading Parameters</h2>
          <TradingSettings />
        </div>

        {/* Placeholder for future sections */}
        <div>
          <h2 className="text-xl font-semibold text-slate-800 mb-4">Risk Management</h2>
          <Card>
            <CardHeader>
              <CardTitle>Risk Management Settings</CardTitle>
              <CardDescription>
                Configure position sizing, maximum drawdown limits, and risk controls.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">Coming soon...</p>
            </CardContent>
          </Card>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-slate-800 mb-4">Execution Settings</h2>
          <Card>
            <CardHeader>
              <CardTitle>Order Execution</CardTitle>
              <CardDescription>
                Configure order types, slippage tolerance, and execution preferences.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">Coming soon...</p>
            </CardContent>
          </Card>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-slate-800 mb-4">Trading Strategy</h2>
          <Card>
            <CardHeader>
              <CardTitle>Strategy Configuration</CardTitle>
              <CardDescription>
                Configure trading strategies, indicators, and signal preferences.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">Coming soon...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

