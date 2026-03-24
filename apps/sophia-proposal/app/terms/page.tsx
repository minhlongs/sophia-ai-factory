/**
 * Terms of Service page — Sophia AI Factory B2B SaaS.
 * Static page, no auth required.
 */

import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service — Sophia AI Factory',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-10">
          <Link href="/" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
            &larr; Back to Home
          </Link>
          <h1 className="mt-4 text-3xl font-bold text-gray-900">Terms of Service</h1>
          <p className="mt-2 text-gray-500 text-sm">Last updated: March 2026</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-8 text-gray-700 text-sm leading-relaxed">

          {/* Section 1 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Service Description</h2>
            <p>
              Sophia AI Factory is a B2B SaaS platform providing Robot-as-a-Service (RaaS) capabilities.
              The platform enables organizations to execute AI-powered automation missions via REST API,
              manage API credentials, and monitor usage of MCU credits.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. Usage Terms</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>You must be at least 18 years old and authorized to enter contracts on behalf of your organization.</li>
              <li>Your account credentials are confidential. You are responsible for all activity under your account.</li>
              <li>You may not use the platform for illegal purposes, to transmit malware, or to violate third-party rights.</li>
              <li>We reserve the right to suspend accounts that violate these terms without prior notice.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. API Usage</h2>
            <p>
              API keys (<code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">sk_live_*</code>) are
              issued per organization. Rate limits apply per plan tier. Exceeding limits may result in
              throttling or temporary suspension. Do not share API keys publicly or embed them in
              client-side code.
            </p>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. MCU Credits</h2>
            <p>
              MCU (Mission Compute Unit) credits are consumed per mission execution. Credits are
              non-refundable once consumed. Unused credits expire 12 months after purchase unless
              otherwise stated in your subscription plan.
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Billing</h2>
            <p>
              Subscription fees are billed monthly or annually via Polar.sh. All prices are in USD
              and exclude applicable taxes. Downgrading or cancelling a plan takes effect at the
              end of the current billing period.
            </p>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Sophia AI Factory and its affiliates shall not
              be liable for indirect, incidental, special, or consequential damages arising from your
              use of the platform. Our total liability shall not exceed the fees paid by you in the
              three months preceding the claim.
            </p>
          </section>

        </div>

        <p className="mt-8 text-center text-xs text-gray-400">
          Questions? Contact us at{' '}
          <a href="mailto:legal@sophia-ai-factory.com" className="text-indigo-600 hover:underline">
            legal@sophia-ai-factory.com
          </a>
        </p>
      </div>
    </div>
  );
}
