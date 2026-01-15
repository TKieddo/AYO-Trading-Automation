"use client";

import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center text-white">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            🤖 AI Trading Platform
          </h1>
          <p className="text-xl md:text-2xl mb-8 opacity-90">
            Automated Trading with AI-Powered Market Analysis
          </p>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 my-12 max-w-5xl mx-auto">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <div className="text-4xl mb-4">🧠</div>
              <h3 className="text-xl font-semibold mb-2">AI-Powered</h3>
              <p className="text-sm opacity-80">
                Advanced LLM-based market analysis and trading decisions
              </p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <div className="text-4xl mb-4">🌐</div>
              <h3 className="text-xl font-semibold mb-2">Multi-Exchange</h3>
              <p className="text-sm opacity-80">
                Trade on multiple exchanges simultaneously - crypto and forex
              </p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-xl font-semibold mb-2">Real-Time</h3>
              <p className="text-sm opacity-80">
                Live market data, technical indicators, and automated execution
              </p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <div className="text-4xl mb-4">🛡️</div>
              <h3 className="text-xl font-semibold mb-2">Risk Management</h3>
              <p className="text-sm opacity-80">
                Automated stop-loss, take-profit, and position sizing
              </p>
            </div>
          </div>
          
          <div className="mt-12">
            <Link
              href="/dashboard"
              className="inline-block bg-white text-purple-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-gray-100 transition-colors shadow-lg"
            >
              Access Dashboard
            </Link>
          </div>
          
          <div className="mt-8 bg-white/10 backdrop-blur-lg rounded-lg p-4 inline-block border border-white/20">
            <p className="text-sm">🚀 Platform is live and ready for trading</p>
          </div>
        </div>
      </div>
    </div>
  );
}
