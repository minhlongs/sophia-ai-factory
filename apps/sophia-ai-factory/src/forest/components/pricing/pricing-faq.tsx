"use client";

/**
 * PricingFaq — 5-question FAQ accordion for /pricing page.
 * Also includes "Talk to Sales" CTA for MASTER tier.
 */

import { useState } from 'react';
import { ChevronDown, Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';

const FAQ_KEYS = ['1', '2', '3', '4', '5'] as const;

type FaqKey = typeof FAQ_KEYS[number];

export function PricingFaq() {
  const t = useTranslations('pricing');
  const [open, setOpen] = useState<FaqKey | null>(null);

  function toggle(key: FaqKey) {
    setOpen(prev => prev === key ? null : key);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 space-y-12">
      {/* FAQ */}
      <section>
        <h2 className="text-2xl font-bold text-center text-foreground mb-8">{t('faq_title')}</h2>
        <div className="space-y-3">
          {FAQ_KEYS.map(key => {
            const isOpen = open === key;
            return (
              <div
                key={key}
                className="bg-card backdrop-blur-md border border-border shadow-sm rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => toggle(key)}
                  className="w-full cursor-pointer flex items-center justify-between px-5 py-4 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm font-medium text-foreground">
                    {t(`faq_${key}_q` as Parameters<typeof t>[0])}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-4">
                    <p className="text-sm text-muted-foreground">
                      {t(`faq_${key}_a` as Parameters<typeof t>[0])}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Talk to Sales — MASTER */}
      <section className="bg-card backdrop-blur-md border border-border shadow-lg rounded-2xl p-8 text-center">
        <h2 className="text-xl font-bold text-foreground mb-2">{t('talk_to_sales')}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t('talk_to_sales_desc')}</p>
        <a
          href="mailto:support@mekongmind.com?subject=Enterprise Plan Inquiry"
          className="cursor-pointer inline-flex items-center gap-2 px-6 py-3 bg-accent hover:bg-accent/90 text-white font-medium rounded-lg transition-colors duration-150"
        >
          <Mail className="w-4 h-4" aria-hidden="true" />
          {t('talk_to_sales_cta')}
        </a>
      </section>
    </div>
  );
}
