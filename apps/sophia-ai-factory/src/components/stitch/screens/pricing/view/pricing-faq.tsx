'use client';
// i18n-namespace: stitch.pricingPage

import React from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/seed/utils/cn';
import { FAQ_INDICES } from './pricing-types';

interface PricingFaqProps {
  openFaq: number | null;
  onToggleFaq: (index: number) => void;
  t: ReturnType<typeof useTranslations>;
}

export function PricingFaq({ openFaq, onToggleFaq, t }: PricingFaqProps) {
  return (
    <section className="mx-auto max-w-3xl" aria-labelledby="faq-heading">
      <h2 id="faq-heading" className="mb-10 text-center text-3xl font-black text-[#0B0F19] dark:text-white font-display">
        {t('faq.title')}
      </h2>
      <div className="space-y-4">
        {FAQ_INDICES.map((index) => {
          const isOpen = openFaq === index;
          return (
            <div
              key={index}
              className="overflow-hidden rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#11131F] shadow-sm dark:shadow-none transition-colors"
            >
              <button
                type="button"
                onClick={() => onToggleFaq(index)}
                className="flex w-full items-center justify-between p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#11131F]"
                aria-expanded={isOpen}
                aria-controls={`faq-answer-${index}`}
              >
                <span className="text-base font-bold text-[#0B0F19] dark:text-white">
                  {t(`faq.items.${index}.question`)}
                </span>
                <ChevronDown
                  className={cn(
                    'h-5 w-5 flex-shrink-0 text-slate-500 dark:text-slate-400 transition-transform duration-200',
                    isOpen && 'rotate-180 text-[#4338CA] dark:text-indigo-400',
                  )}
                  aria-hidden="true"
                />
              </button>
              <div
                id={`faq-answer-${index}`}
                role="region"
                className={cn(
                  'overflow-hidden transition-all duration-300 ease-in-out',
                  isOpen ? 'max-h-96' : 'max-h-0',
                )}
              >
                <p className="px-5 pb-5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-[#E2E8F0] dark:border-white/[0.06] pt-3">
                  {t(`faq.items.${index}.answer`)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
