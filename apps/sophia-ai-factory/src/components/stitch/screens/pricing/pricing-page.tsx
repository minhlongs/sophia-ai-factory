'use client';

import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { Button, Card, CardHeader, CardContent, Badge, cn } from '@/components/stitch';

const tiers = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 29,
    yearlyPrice: 277, // $29 * 12 * 0.8
    description: 'Perfect for individuals and side projects getting started.',
    features: [
      '100 subscribers',
      'Standard dashboards',
      'Email support',
      'Basic analytics',
      '1 workspace',
    ],
    cta: 'Start Free Trial',
    popular: false,
  },
  {
    id: 'professional',
    name: 'Professional',
    monthlyPrice: 79,
    yearlyPrice: 755,
    description: 'For growing teams that need more power and flexibility.',
    features: [
      '1,000 subscribers',
      'Advanced dashboards',
      'Priority email support',
      'Advanced analytics',
      '5 workspaces',
      'API access',
      'Custom integrations',
    ],
    cta: 'Start Free Trial',
    popular: true,
  },
  {
    id: 'business',
    name: 'Business',
    monthlyPrice: 199,
    yearlyPrice: 1915,
    description: 'For organizations that require enterprise-grade features.',
    features: [
      '10,000 subscribers',
      'Custom dashboards',
      '24/7 phone support',
      'Advanced analytics + AI',
      'Unlimited workspaces',
      'API access',
      'Custom integrations',
      'SSO & advanced security',
      'Dedicated account manager',
    ],
    cta: 'Contact Sales',
    popular: false,
  },
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(true);

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <nav className="w-full top-0 sticky z-50 bg-surface border-b border-outline-variant">
        <div className="flex justify-between items-center h-16 px-lg max-w-container-max mx-auto">
          <div className="text-headline-md font-headline-md text-primary font-bold">
            Sophia AI
          </div>
          <div className="hidden md:flex items-center space-x-lg">
            <a href="#" className="text-on-surface-variant hover:text-primary transition-colors font-body-md">
              Product
            </a>
            <a href="#" className="text-on-surface-variant hover:text-primary transition-colors font-body-md">
              Features
            </a>
            <a href="#" className="text-primary font-bold border-b-2 border-primary py-1">
              Pricing
            </a>
          </div>
          <div className="flex items-center space-x-md">
            <Button variant="ghost" size="md">Log In</Button>
            <Button size="md">Sign Up</Button>
          </div>
        </div>
      </nav>

      <main className="relative">
        {/* Hero Section */}
        <section className="pt-24 pb-16 px-lg text-center max-w-container-max mx-auto">
          <h1 className="font-headline-xl text-headline-xl md:text-headline-xl text-on-background mb-md">
            Simple, Transparent Pricing
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mx-auto mb-xl">
            Choose the right plan for your team and start growing your business today. No hidden fees, no complicated contracts.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center space-x-md mb-12">
            <span className="font-label-md text-label-md text-on-surface-variant">Monthly</span>
            <button
              onClick={() => setAnnual(!annual)}
              className={`
                relative w-12 h-6 rounded-full transition-colors duration-300
                ${annual ? 'bg-surface-container-highest' : 'bg-primary'}
                focus:outline-none focus:ring-2 focus:ring-primary/20
              `}
            >
              <span
                className={`
                  absolute top-1 w-4 h-4 bg-primary rounded-full transition-transform duration-300
                  ${annual ? 'left-1' : 'left-7'}
                `}
              />
            </button>
            <span className="font-label-md text-label-md text-on-surface-variant">
              Annual{' '}
              <span className="text-primary font-bold">(Save 20%)</span>
            </span>
          </div>
        </section>

        {/* Pricing Grid */}
        <section className="pb-24 px-lg max-w-container-max mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-lg items-stretch">
            {tiers.map((tier) => (
              <Card
                key={tier.id}
                variant={tier.popular ? 'outlined' : 'elevated'}
                padding="xl"
                className={cn(
                  'flex flex-col',
                  tier.popular && 'border-primary relative z-10 scale-105 shadow-xl'
                )}
              >
                {tier.popular && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 popular-badge-gradient text-on-primary px-lg py-1 rounded-full text-label-sm font-label-sm uppercase tracking-wider">
                    Most Popular
                  </div>
                )}

                <CardHeader className="mb-lg !p-0">
                  <h3 className="font-headline-md text-headline-md text-on-surface mb-sm">
                    {tier.name}
                  </h3>
                  <div className="flex items-baseline space-x-1">
                    <span className="font-headline-xl text-headline-xl text-on-background">
                      ${annual ? tier.yearlyPrice : tier.monthlyPrice}
                    </span>
                    <span className="font-body-md text-body-md text-on-surface-variant">
                      /{annual ? 'year' : 'mo'}
                    </span>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-md">
                    {tier.description}
                  </p>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col !p-0">
                  <ul className="space-y-md mb-xl flex-grow">
                    {tier.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start space-x-sm">
                        <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" style={{ fill: 'currentColor' }} />
                        <span className="font-body-md text-body-md text-on-surface">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    fullWidth
                    variant={tier.popular ? 'primary' : 'outline'}
                    size="lg"
                  >
                    {tier.cta}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* FAQ Section */}
        <section className="pb-24 px-lg max-w-3xl mx-auto">
          <h2 className="font-headline-lg text-headline-lg text-on-surface text-center mb-xl">
            Frequently Asked Questions
          </h2>
          <div className="space-y-md">
            {[
              {
                q: 'Can I change plans later?',
                a: 'Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately, and we&apos;ll prorate any differences.',
              },
              {
                q: 'What payment methods do you accept?',
                a: 'We accept all major credit cards, PayPal, and bank transfers for annual plans. All payments are processed securely.',
              },
              {
                q: 'Is there a free trial?',
                a: 'Yes! All plans come with a 14-day free trial. No credit card required to start.',
              },
              {
                q: 'What happens if I exceed my subscriber limit?',
                a: 'We&apos;ll notify you when you approach your limit. You can upgrade your plan or contact us for a custom solution.',
              },
            ].map((faq, idx) => (
              <Card key={idx} padding="lg">
                <h3 className="font-headline-sm text-headline-sm text-on-surface mb-sm">
                  {faq.q}
                </h3>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  {faq.a}
                </p>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
