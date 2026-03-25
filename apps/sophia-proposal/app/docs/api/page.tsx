/**
 * Interactive API reference — /docs/api
 *
 * Renders hero, quickstart, command reference, auth, rate limits,
 * then the full OpenAPI 3.1 spec via Scalar API Reference (CDN).
 * Static server component — no auth required.
 */

import type { Metadata } from 'next';
import { ApiCommandReferenceTable } from './api-command-reference-table';

export const metadata: Metadata = {
  title: 'API Reference — Sophia AI Factory',
  description:
    'Interactive REST API documentation for the Sophia AI Factory RaaS platform. ' +
    'Submit AI missions, poll results, and integrate with webhooks.',
  openGraph: {
    title: 'Sophia AI Factory API Reference',
    description: 'Full REST API documentation for the RaaS platform.',
    type: 'website',
  },
};

const QUICKSTART_CODE = `import { SophiaClient } from '@sophia/raas-sdk';
const sophia = new SophiaClient({ apiKey: 'sk_live_xxx' });
const mission = await sophia.missions.create({
  command: 'proposal:create',
  params: { client_name: 'Acme Corp', product_name: 'Your Product' }
});
console.log(mission.result);`;

const RATE_LIMITS = [
  { tier: 'Starter',   rpm: '30',        concurrent: '3',   mcu: '500' },
  { tier: 'Growth',    rpm: '100',       concurrent: '10',  mcu: '2,000' },
  { tier: 'Premium',   rpm: '300',       concurrent: '30',  mcu: '10,000' },
  { tier: 'Master',    rpm: 'Unlimited', concurrent: '100', mcu: 'Unlimited' },
];

export default function ApiDocsPage() {
  return (
    <>
      <div className="max-w-5xl mx-auto px-6 py-16">

        {/* Hero */}
        <div className="mb-14 text-center">
          <div className="inline-flex items-center gap-2 bg-primary-container text-on-primary-container text-sm font-medium px-4 py-1.5 rounded-full mb-6">
            <span className="material-symbols-outlined text-base">rocket_launch</span>
            RaaS API v1.0
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-on-surface mb-4">
            Ship your first AI mission in <span className="text-primary">3 minutes</span>
          </h1>
          <p className="text-lg text-on-surface-variant max-w-2xl mx-auto mb-8">
            The Sophia RaaS API lets you run 17 AI commands — proposals, videos, battlecards,
            outreach sequences, and more — from any language, any platform.
          </p>
          <a
            href="/sophia-postman-collection.json"
            download
            className="inline-flex items-center gap-2 bg-surface-container border border-outline-variant text-on-surface text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-base">download</span>
            Download Postman Collection
          </a>
        </div>

        {/* Quick Start */}
        <section className="mb-14">
          <h2 className="text-2xl font-semibold text-on-surface mb-6">Quick Start</h2>
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            {/* Step 1 */}
            <div className="bg-surface-container rounded-2xl p-6 border border-outline-variant">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-8 h-8 rounded-full bg-primary text-on-primary text-sm font-bold flex items-center justify-center">1</span>
                <h3 className="font-semibold text-on-surface">Get API Key</h3>
              </div>
              <p className="text-sm text-on-surface-variant">
                Dashboard → Settings → API Keys → Generate
              </p>
            </div>
            {/* Step 2 */}
            <div className="bg-surface-container rounded-2xl p-6 border border-outline-variant">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-8 h-8 rounded-full bg-primary text-on-primary text-sm font-bold flex items-center justify-center">2</span>
                <h3 className="font-semibold text-on-surface">Install SDK</h3>
              </div>
              <code className="block bg-[#0a0f1a] text-green-400 text-sm px-4 py-3 rounded-xl font-mono">
                npm install @sophia/raas-sdk
              </code>
            </div>
            {/* Step 3 */}
            <div className="bg-surface-container rounded-2xl p-6 border border-outline-variant">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-8 h-8 rounded-full bg-primary text-on-primary text-sm font-bold flex items-center justify-center">3</span>
                <h3 className="font-semibold text-on-surface">Run Mission</h3>
              </div>
              <p className="text-sm text-on-surface-variant">See code example below</p>
            </div>
          </div>
          {/* Code block */}
          <div className="relative rounded-2xl overflow-hidden border border-outline-variant">
            <div className="flex items-center justify-between bg-[#0a0f1a] px-5 py-3 border-b border-white/10">
              <span className="text-xs text-gray-400 font-mono">mission.ts</span>
              <span className="text-xs text-gray-500">TypeScript</span>
            </div>
            <pre className="bg-[#0a0f1a] text-sm text-gray-100 px-5 py-5 overflow-x-auto">
              <code>{QUICKSTART_CODE}</code>
            </pre>
          </div>
        </section>

        {/* Command Reference Table */}
        <ApiCommandReferenceTable />

        {/* Authentication */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-on-surface mb-4">Authentication</h2>
          <div className="bg-surface-container rounded-2xl p-6 border border-outline-variant space-y-4">
            <p className="text-on-surface-variant">
              All API requests require a Bearer token in the <code className="bg-surface-container-high text-primary px-1.5 py-0.5 rounded text-sm font-mono">Authorization</code> header.
            </p>
            <pre className="bg-[#0a0f1a] text-sm text-gray-100 px-5 py-4 rounded-xl overflow-x-auto">
              <code>{`Authorization: Bearer sk_live_your_api_key_here`}</code>
            </pre>
            <ul className="text-sm text-on-surface-variant space-y-1 list-disc list-inside">
              <li>API keys are prefixed <code className="font-mono text-primary">sk_live_</code> for production</li>
              <li>Generate keys in Dashboard → Settings → API Keys</li>
              <li>Keys are org-scoped — usage is tracked per key</li>
            </ul>
          </div>
        </section>

        {/* Rate Limits */}
        <section className="mb-14">
          <h2 className="text-2xl font-semibold text-on-surface mb-4">Rate Limits</h2>
          <div className="overflow-x-auto rounded-xl border border-outline-variant">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-container border-b border-outline-variant">
                  <th className="text-left px-4 py-3 text-on-surface-variant font-medium">Tier</th>
                  <th className="text-left px-4 py-3 text-on-surface-variant font-medium">Requests / min</th>
                  <th className="text-left px-4 py-3 text-on-surface-variant font-medium">Concurrent</th>
                  <th className="text-left px-4 py-3 text-on-surface-variant font-medium">MCU / month</th>
                </tr>
              </thead>
              <tbody>
                {RATE_LIMITS.map((row) => (
                  <tr key={row.tier} className="border-b border-outline-variant last:border-0 hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-3 font-semibold text-on-surface">{row.tier}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{row.rpm}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{row.concurrent}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{row.mcu}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-on-surface-variant mt-3">
            Rate limit headers (<code className="font-mono text-primary">X-RateLimit-Remaining</code>, <code className="font-mono text-primary">Retry-After</code>) are returned on every response.
          </p>
        </section>

        <div className="border-t border-outline-variant pt-4 mb-4">
          <p className="text-sm text-on-surface-variant text-center">
            Interactive API explorer below — try requests directly in your browser.
          </p>
        </div>
      </div>

      {/* Scalar API Reference */}
      {/* @ts-expect-error custom element not in JSX intrinsics */}
      <api-reference
        spec-url="/openapi.yaml"
        data-theme="dark"
        data-layout="modern"
        data-hide-download-button="false"
        style={{ display: 'block', minHeight: '100vh' }}
      />

      {/* Scalar CDN — no npm dependency */}
      <script
        src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@latest/dist/browser/standalone.min.js"
        crossOrigin="anonymous"
        async
      />
    </>
  );
}
