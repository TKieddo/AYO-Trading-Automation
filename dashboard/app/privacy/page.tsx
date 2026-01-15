export default function PrivacyPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl ring-1 ring-slate-200 bg-white p-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="inline-flex items-center gap-2 rounded-full ring-1 ring-slate-200 px-3 py-1 text-xs text-slate-600 bg-slate-50">Privacy</span>
          <h1 className="text-xl font-semibold text-slate-800">Privacy Policy</h1>
        </div>
        <p className="text-slate-600">This Privacy Policy explains how AYO handles information. We aim to collect the minimum necessary to operate the platform safely and effectively.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="rounded-2xl ring-1 ring-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-800 mb-2">Information We Collect</h3>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li>Account and contact details you provide (e.g., email)</li>
            <li>Configuration data (strategy parameters, preferences)</li>
            <li>Operational logs and metrics for reliability and security</li>
          </ul>
        </section>
        <section className="rounded-2xl ring-1 ring-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-800 mb-2">What We Do Not Collect</h3>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li>No custody of your funds</li>
            <li>No storage of your exchange passwords</li>
            <li>API keys should be least-privilege; may be encrypted at rest</li>
          </ul>
        </section>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <section className="rounded-2xl ring-1 ring-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-800 mb-2">Use of Information</h3>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li>Operate and improve AYO features and reliability</li>
            <li>Detect, prevent, and respond to security incidents</li>
            <li>Comply with legal obligations</li>
          </ul>
        </section>
        <section className="rounded-2xl ring-1 ring-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-800 mb-2">Sharing</h3>
          <p className="text-slate-600">We do not sell your data. We may share limited information with service providers under contract to support platform reliability and security, subject to confidentiality obligations.</p>
        </section>
        <section className="rounded-2xl ring-1 ring-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-800 mb-2">Data Retention</h3>
          <p className="text-slate-600">We retain data only as long as necessary for the purposes above, then delete or anonymize it.</p>
        </section>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="rounded-2xl ring-1 ring-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-800 mb-2">Your Choices</h3>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li>Access, update, or delete your account information</li>
            <li>Adjust strategy and logging preferences</li>
          </ul>
        </section>
        <section className="rounded-2xl ring-1 ring-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-800 mb-2">Security</h3>
          <p className="text-slate-600">We use technical and organizational measures to protect information. No method of transmission or storage is 100% secure.</p>
        </section>
      </div>

      <div className="rounded-2xl ring-1 ring-slate-200 bg-white p-5">
        <h3 className="font-semibold text-slate-800 mb-2">Contact</h3>
        <p className="text-slate-600">If you have questions about this policy or your data, please contact us.</p>
      </div>
    </div>
  );
}


