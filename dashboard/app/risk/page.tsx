export default function RiskNoticePage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl ring-1 ring-slate-200 bg-white p-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="inline-flex items-center gap-2 rounded-full ring-1 ring-slate-200 px-3 py-1 text-xs text-slate-600 bg-slate-50">Risk</span>
          <h1 className="text-xl font-semibold text-slate-800">Risk Notice</h1>
        </div>
        <p className="text-slate-600">Trading digital assets involves substantial risk and may result in the loss of your capital. Past performance does not guarantee future results. AYO is not a financial advisor and does not provide recommendations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="rounded-2xl ring-1 ring-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-800 mb-2">Key Risks</h3>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li>Market risk: volatility, gaps, illiquidity</li>
            <li>Execution risk: slippage, partial fills, failed txs</li>
            <li>Technology risk: outages, latency, defects, congestion</li>
            <li>Integration risk: third-party failures or API changes (e.g., Hyperliquid)</li>
            <li>Security risk: key compromise, phishing, malware</li>
            <li>Model risk: overfitting, regime shifts, invalid assumptions</li>
            <li>Human risk: misconfiguration, incorrect parameters, insufficient testing</li>
            <li>Regulatory risk: changing laws or enforcement</li>
          </ul>
        </section>
        <section className="rounded-2xl ring-1 ring-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-800 mb-2">Your Responsibilities</h3>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li>Understand risks before enabling live execution</li>
            <li>Use least-privilege API permissions; protect credentials</li>
            <li>Backtest and simulate; continuously monitor performance</li>
            <li>Set conservative limits for size, leverage, drawdown</li>
            <li>Comply with laws, taxes, and exchange rules</li>
          </ul>
        </section>
      </div>

      <div className="rounded-2xl ring-1 ring-red-200 bg-red-50 p-5">
        <h3 className="font-semibold text-red-800 mb-2">No Guarantee</h3>
        <p className="text-red-900/80">AYO provides tools “as is” with no guarantee of profitability, accuracy, or uninterrupted operation. You are solely responsible for trades placed using the platform.</p>
      </div>
    </div>
  );
}


