/**
 * Privacy Policy page — Sophia AI Factory B2B SaaS.
 * GDPR-friendly. Static page, no auth required.
 */

import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — Sophia AI Factory',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-10">
          <Link href="/" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
            &larr; Back to Home
          </Link>
          <h1 className="mt-4 text-3xl font-bold text-gray-900">Privacy Policy</h1>
          <p className="mt-2 text-gray-500 text-sm">Last updated: March 2026</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-8 text-gray-700 text-sm leading-relaxed">

          {/* Section 1 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Data Collection</h2>
            <p>We collect the following categories of data when you use Sophia AI Factory:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Account data:</strong> email address, organization name, billing details.</li>
              <li><strong>Usage data:</strong> API call logs, mission execution metadata, MCU credit consumption.</li>
              <li><strong>Technical data:</strong> IP address, browser/client type, request timestamps.</li>
            </ul>
            <p className="mt-2">We do not collect sensitive personal data (health, financial account numbers, government IDs).</p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. Data Usage</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>To provide, operate, and improve the platform.</li>
              <li>To authenticate users and secure API access.</li>
              <li>To generate invoices and process billing via Polar.sh.</li>
              <li>To send transactional emails (account events, billing receipts).</li>
              <li>To detect abuse and enforce rate limits.</li>
            </ul>
            <p className="mt-2">We do not sell your data to third parties.</p>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. API Data</h2>
            <p>
              Mission payloads (inputs and outputs) sent through the RaaS API are processed to execute
              your requested tasks. We may retain mission logs for up to 90 days for debugging and
              audit purposes. You may request deletion of mission data by contacting support.
            </p>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Third-Party Services</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Polar.sh</strong> — handles subscription billing and payment processing.
                Subject to <a href="https://polar.sh/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">Polar&apos;s Privacy Policy</a>.
              </li>
              <li>
                <strong>Cloudflare</strong> — provides edge delivery, Workers runtime, and D1 database hosting.
                Subject to <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">Cloudflare&apos;s Privacy Policy</a>.
              </li>
            </ul>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Data Retention</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Account data is retained while your account is active and for 30 days after deletion.</li>
              <li>Mission logs are retained for 90 days.</li>
              <li>Billing records are retained for 7 years as required by law.</li>
            </ul>
            <p className="mt-2">
              You may request export or deletion of your personal data at any time (GDPR Art. 15–17).
            </p>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. Contact</h2>
            <p>
              For privacy inquiries, data access requests, or deletion requests, contact our Data
              Protection team at{' '}
              <a href="mailto:privacy@sophia-ai-factory.com" className="text-indigo-600 hover:underline">
                privacy@sophia-ai-factory.com
              </a>
              . We respond within 30 days.
            </p>
          </section>

        </div>

        <p className="mt-8 text-center text-xs text-gray-400">
          Sophia AI Factory — GDPR compliant B2B SaaS platform.
        </p>
      </div>
    </div>
  );
}
