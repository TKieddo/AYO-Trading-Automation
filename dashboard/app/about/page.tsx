export default function AboutPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl ring-1 ring-slate-200 bg-white p-6">
        <div className="flex items-center gap-3 mb-3">
          <span className="inline-flex items-center gap-2 rounded-full ring-1 ring-slate-200 px-3 py-1 text-xs text-slate-600 bg-slate-50">About</span>
          <h1 className="text-xl font-semibold text-slate-800">AYO — Rational Trading Automation</h1>
        </div>
        <p className="text-slate-600">AYO is an AI trading agent that connects to Aster DEX and Binance Futures to analyze markets, generate insights, and execute rules-based strategies without emotion. Our mission is to bring disciplined, transparent, and automatable trading tooling to crypto-native participants.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl ring-1 ring-slate-200 bg-white p-5">
          <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Core</div>
          <h3 className="font-semibold text-slate-800 mb-2">What AYO Does</h3>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li>Multi-timeframe technical analysis</li>
            <li>Monitors momentum, volatility, structure</li>
            <li>Rules-based decisions to reduce bias</li>
            <li>Executes on Aster DEX or Binance Futures with your limits</li>
            <li>Tracks performance, fees, and PnL</li>
          </ul>
        </div>
        <div className="rounded-2xl ring-1 ring-slate-200 bg-white p-5">
          <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Flow</div>
          <h3 className="font-semibold text-slate-800 mb-2">How It Works</h3>
          <p className="text-slate-600">AYO ingests data, evaluates conditions against strategy rules, and—subject to your approvals—submits orders via Aster DEX or Binance Futures. Safety features include position sizing, max-loss constraints, and stop logic. You retain full control: run in simulation, enable/disable, and tune parameters.</p>
        </div>
        <div className="rounded-2xl ring-1 ring-slate-200 bg-white p-5">
          <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Values</div>
          <h3 className="font-semibold text-slate-800 mb-2">Principles</h3>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li>Discipline over impulse</li>
            <li>Transparency and exportable history</li>
            <li>Composable, modular signals and risk</li>
            <li>Security by least-privilege</li>
          </ul>
        </div>
      </div>

      <div className="rounded-2xl ring-1 ring-emerald-200 bg-emerald-50 p-5">
        <h3 className="font-semibold text-emerald-800 mb-1">Important Note</h3>
        <p className="text-emerald-900/80">AYO does not provide financial advice. Nothing on this platform should be interpreted as a solicitation or recommendation. Trading is risky and you are solely responsible for your decisions. See our <a className="underline" href="/disclaimer">Disclaimer</a> and <a className="underline" href="/risk">Risk Notice</a>.</p>
      </div>
    </div>
  );
}


