'use client';

/**
 * Pricing Cards — 4 RaaS tiers for Sophia AI Factory.
 * Handles Polar.sh checkout redirect on CTA click.
 */

const TIERS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 99,
    mcu: 500,
    bestFor: 'Solo founders, basic automation',
    popular: false,
    polarUrl: 'https://buy.polar.sh/polar_cl_sophia_starter',
    features: [
      '500 MCU / month',
      'Proposal generation',
      'Social content bundle',
      'PDF & HTML export',
      'Community support',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 249,
    mcu: 1500,
    bestFor: 'Small agencies, content + proposals',
    popular: true,
    polarUrl: 'https://buy.polar.sh/polar_cl_sophia_growth',
    features: [
      '1,500 MCU / month',
      'Everything in Starter',
      'Video script generation',
      'Affiliate content suite',
      'Priority support',
      'Usage analytics',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 499,
    mcu: 4000,
    bestFor: 'Growing agencies, full RaaS suite',
    popular: false,
    polarUrl: 'https://buy.polar.sh/polar_cl_sophia_premium',
    features: [
      '4,000 MCU / month',
      'Everything in Growth',
      'HeyGen video production',
      'Custom mission templates',
      'CRM & affiliate integrations',
      'Dedicated support',
    ],
  },
  {
    id: 'master',
    name: 'Master',
    price: 999,
    mcu: null,
    bestFor: 'Enterprise, white-label RaaS',
    popular: false,
    polarUrl: 'https://buy.polar.sh/polar_cl_sophia_master',
    features: [
      'Unlimited MCU',
      'Everything in Premium',
      'White-label branding',
      'Custom LLM routing',
      'SLA guarantee',
      'Dedicated account manager',
    ],
  },
] as const;

export function PricingCards() {
  function handleCheckout(polarUrl: string) {
    window.open(polarUrl, '_blank');
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
      {TIERS.map(tier => (
        <div
          key={tier.id}
          className={`relative flex flex-col rounded-2xl p-6 border transition-shadow ${
            tier.popular
              ? 'border-orange-400 bg-orange-50 shadow-lg shadow-orange-100'
              : 'border-gray-200 bg-white hover:shadow-md'
          }`}
        >
          {tier.popular && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-xs font-bold px-4 py-1 rounded-full">
              Most Popular
            </div>
          )}

          {/* Header */}
          <div className="mb-4">
            <h3 className="text-lg font-bold text-gray-900">{tier.name}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{tier.bestFor}</p>
          </div>

          {/* Price */}
          <div className="mb-4">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-extrabold text-gray-900">${tier.price}</span>
              <span className="text-gray-500 text-sm">/mo</span>
            </div>
            <p className="text-sm font-medium text-orange-600 mt-1">
              {tier.mcu ? `${tier.mcu.toLocaleString()} MCU / month` : 'Unlimited MCU'}
            </p>
          </div>

          {/* Features */}
          <ul className="space-y-2 flex-1 mb-6">
            {tier.features.map(f => (
              <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="material-symbols-outlined text-orange-500 text-base mt-0.5 flex-shrink-0">check_circle</span>
                {f}
              </li>
            ))}
          </ul>

          {/* CTA */}
          <button
            onClick={() => handleCheckout(tier.polarUrl)}
            className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-colors ${
              tier.popular
                ? 'bg-orange-500 text-white hover:bg-orange-600'
                : 'bg-gray-900 text-white hover:bg-gray-700'
            }`}
          >
            Get Started
          </button>
        </div>
      ))}
    </div>
  );
}
