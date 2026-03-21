/**
 * Marketing Pricing Page — standalone (no dashboard layout)
 * Hero + PricingCards + FAQ + CTA
 */

import type { Metadata } from 'next';
import { PricingCards } from '@/components/pricing/pricing-cards';

export const metadata: Metadata = {
  title: 'Pricing | Sophia AI Factory',
  description: 'Simple, transparent pricing for AI-powered business automation. Start free with 50 MCU.',
};

const FAQ = [
  {
    q: 'What is an MCU?',
    a: 'MCU (Mission Credit Unit) is our compute currency. 1 MCU = 1 unit of AI work. A basic proposal costs ~25 MCU, a full video ~500 MCU.',
  },
  {
    q: 'Can I upgrade or downgrade anytime?',
    a: 'Yes. Plan changes take effect immediately. Unused MCU credits roll over for 30 days.',
  },
  {
    q: 'What happens when I run out of MCU?',
    a: 'Missions queue until you top up or upgrade. You can buy MCU add-ons anytime without changing your plan.',
  },
  {
    q: 'Is there a free trial?',
    a: 'Yes — every new account starts with 50 free MCU, enough to generate 2 proposals or 5 social bundles.',
  },
  {
    q: 'Do you offer white-label or reseller pricing?',
    a: 'The Master plan includes full white-label branding. Contact us for custom reseller agreements.',
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      {/* Nav bar */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-sm">smart_toy</span>
            </div>
            <span className="font-bold text-gray-900">Sophia AI Factory</span>
          </a>
          <div className="flex items-center gap-4">
            <a href="/" className="text-sm text-gray-600 hover:text-gray-900">Home</a>
            <a href="/pricing" className="text-sm font-semibold text-orange-600">Pricing</a>
            <a href="/login" className="text-sm px-4 py-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium">
              Get Started
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-16 text-center px-4">
        <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
          <span className="material-symbols-outlined text-base">bolt</span>
          50 free MCU on signup — no credit card required
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4 tracking-tight">
          AI-Powered Business<br className="hidden md:block" /> Automation
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
          Sophia sells OpenClaw command execution as RaaS. Generate proposals, videos, and content at scale — pay only for what you use.
        </p>
      </section>

      {/* Pricing cards */}
      <section className="pb-16 px-4">
        <PricingCards />
      </section>

      {/* FAQ */}
      <section className="py-16 bg-white border-t border-gray-100">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {FAQ.map(({ q, a }) => (
              <div key={q} className="border-b border-gray-100 pb-6 last:border-0">
                <h3 className="font-semibold text-gray-900 mb-2">{q}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-16 bg-orange-500 text-white text-center px-4">
        <h2 className="text-2xl md:text-3xl font-bold mb-3">Ready to automate your business?</h2>
        <p className="text-orange-100 mb-6 text-lg">Start free — 50 MCU included, no credit card needed.</p>
        <a
          href="/login"
          className="inline-block px-8 py-3 bg-white text-orange-600 font-bold rounded-xl hover:bg-orange-50 transition-colors text-lg"
        >
          Start Free Trial — 50 MCU
        </a>
      </section>
    </main>
  );
}
