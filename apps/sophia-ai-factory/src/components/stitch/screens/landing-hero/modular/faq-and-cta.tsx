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

      {/* ════ BOTTOM CALL TO ACTION BANNER ══════════════════════════════════ */}
      <section className="py-24 border-t border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8F9FC] dark:bg-[#090A10] relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
          <div className="studio-glass p-8 sm:p-14 rounded-3xl bg-white dark:bg-[#11131F] border border-[#E2E8F0] dark:border-white/[0.08] shadow-xl dark:shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-[#D97706]/10 dark:bg-[#F59E0B]/15 flex items-center justify-center text-[#D97706] dark:text-[#F59E0B] mx-auto mb-6">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-3xl sm:text-5xl font-black text-[#0B0F19] dark:text-white tracking-tight mb-4 font-display">
              {t('cta.readyTitle')}
            </h3>
            <p className="text-slate-600 dark:text-slate-300 text-base sm:text-lg max-w-2xl mx-auto mb-8 leading-relaxed">
              {t('cta.readySubtitle')}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-9 py-4 rounded-xl text-base font-bold text-white bg-[#4338CA] hover:bg-indigo-600 dark:bg-[#6366F1] dark:hover:bg-indigo-500 shadow-lg shadow-[#4338CA]/20 dark:shadow-indigo-500/25 transition-all active:scale-[0.98]"
              >
                <span>{t('cta.startFree')}</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/pricing"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-base font-bold text-[#0B0F19] dark:text-slate-300 hover:bg-slate-50 dark:hover:text-white bg-[#F8F9FC] dark:bg-white/[0.05] dark:hover:bg-white/[0.1] border border-[#E2E8F0] dark:border-white/10 transition-all"
              >
                <span>{t('cta.viewPricing')}</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
