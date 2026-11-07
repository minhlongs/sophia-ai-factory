// i18n-namespace: stitch.landing
import React, { useState } from 'react';
import { Link } from '@/navigation';
import { ArrowRight, ChevronDown, Zap } from 'lucide-react';
import { cn } from '@/seed/utils/cn';
import type { FaqItem } from './types';

interface FaqAndCtaProps {
  t: (key: string) => string;
  tLanding: (key: string) => string;
}

export function FaqAndCta({ t, tLanding }: FaqAndCtaProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (idx: number) => {
    setOpenFaq((prev) => (prev === idx ? null : idx));
  };

  const faqList: FaqItem[] = [
    {
      q: tLanding('faq.items.quality.question'),
      a: tLanding('faq.items.quality.answer'),
    },
    {
      q: tLanding('faq.items.copyright.question'),
      a: tLanding('faq.items.copyright.answer'),
    },
    {
      q: tLanding('faq.items.time.question'),
      a: tLanding('faq.items.time.answer'),
    },
    {
      q: tLanding('faq.items.support.question'),
      a: tLanding('faq.items.support.answer'),
    },
  ];

  return (
    <>
      {/* ════ FAQ ACCORDION SECTION ═════════════════════════════════════════ */}
      <section className="py-24 border-t border-[#E2E8F0] dark:border-white/[0.08] bg-slate-100/60 dark:bg-[#0E1017]">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#4338CA] dark:text-indigo-400 mb-3">
              FAQ
            </h2>
            <h3 className="text-3xl sm:text-4xl font-black text-[#0B0F19] dark:text-white tracking-tight font-display">
              {tLanding('faq.title')}
            </h3>
          </div>

          <div className="space-y-4">
            {faqList.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#11131F] overflow-hidden transition-colors shadow-sm dark:shadow-none"
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(idx)}
                    className="w-full flex items-center justify-between p-5 text-left text-base font-bold text-[#0B0F19] dark:text-white hover:text-[#4338CA] dark:hover:text-indigo-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#11131F]"
                    aria-expanded={isOpen}
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={cn(
                        'w-5 h-5 text-slate-500 dark:text-slate-400 transition-transform duration-200',
                        isOpen && 'rotate-180 text-[#4338CA] dark:text-indigo-400'
                      )}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-[#E2E8F0] dark:border-white/[0.06] pt-4">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ════ CHAPTER 04: #join — .v3-core Final CTA Panel ══════════════════ */}
      <section
        id="join"
        className="chapter border-t border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8F9FC] dark:bg-[#090A10] relative overflow-hidden"
      >
        <div className="panel studio-glass text-center relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-[#D97706]/10 dark:bg-[#F59E0B]/15 flex items-center justify-center text-[#D97706] dark:text-[#F59E0B] mx-auto mb-4">
            <Zap className="w-6 h-6" />
          </div>
          <p className="kicker">{t('v3Core.joinKicker')}</p>
          <h2 className="h2 h2-xl">{t('cta.readyTitle')}</h2>
          <p className="lead mx-auto mb-8">{t('cta.readySubtitle')}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register" className="btn btn-lg btn-primary w-full sm:w-auto">
              <span>{t('cta.startFree')}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/pricing" className="btn btn-lg btn-outline w-full sm:w-auto">
              <span>{t('cta.viewPricing')}</span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
