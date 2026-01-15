export default function TermsPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl ring-1 ring-slate-200 bg-white p-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="inline-flex items-center gap-2 rounded-full ring-1 ring-slate-200 px-3 py-1 text-xs text-slate-600 bg-slate-50">Legal</span>
          <h1 className="text-xl font-semibold text-slate-800">Terms of Service</h1>
        </div>
        <p className="text-slate-600">Welcome to AYO. By accessing or using the platform you agree to these Terms. If you do not agree, do not use AYO.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="rounded-2xl ring-1 ring-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-800 mb-2">Use of the Platform</h3>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li>Comply with applicable laws and exchange rules (e.g., Hyperliquid)</li>
            <li>Safeguard credentials, API keys, and devices</li>
            <li>AYO may update, suspend, or discontinue features</li>
          </ul>
        </section>
        <section className="rounded-2xl ring-1 ring-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-800 mb-2">No Advice</h3>
          <p className="text-slate-600">AYO provides tools and automation. It does not provide financial, investment, tax, or legal advice. You make your own decisions.</p>
        </section>
        <section className="rounded-2xl ring-1 ring-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-800 mb-2">Risk</h3>
          <p className="text-slate-600">Trading is risky and can result in loss of capital. See the <a className="underline" href="/risk">Risk Notice</a>.</p>
        </section>
        <section className="rounded-2xl ring-1 ring-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-800 mb-2">Integrations</h3>
          <p className="text-slate-600">AYO integrates with third-party services such as Hyperliquid. We do not control third parties and are not responsible for their performance, security, or availability.</p>
        </section>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <section className="rounded-2xl ring-1 ring-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-800 mb-2">Data and Privacy</h3>
          <p className="text-slate-600">See the <a className="underline" href="/privacy">Privacy Policy</a>. You are responsible for complying with data obligations in your jurisdiction.</p>
        </section>
        <section className="rounded-2xl ring-1 ring-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-800 mb-2">Limitation of Liability</h3>
          <p className="text-slate-600">To the fullest extent permitted by law, AYO is not liable for indirect, incidental, special, consequential, or exemplary damages, or for lost profits, revenue, or data.</p>
        </section>
        <section className="rounded-2xl ring-1 ring-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-800 mb-2">No Warranties</h3>
          <p className="text-slate-600">AYO is provided “as is” without warranties of any kind, including implied warranties of merchantability, fitness for a particular purpose, and non-infringement.</p>
        </section>
      </div>

      <div className="rounded-2xl ring-1 ring-slate-200 bg-white p-5">
        <h3 className="font-semibold text-slate-800 mb-2">Indemnification & Changes</h3>
        <ul className="list-disc pl-5 space-y-1 text-slate-600">
          <li>You agree to indemnify and hold harmless AYO from claims arising out of your use of the platform or violation of these Terms.</li>
          <li>We may modify these Terms by posting an updated version. Continued use after changes constitutes acceptance.</li>
        </ul>
      </div>
    </div>
  );
}


