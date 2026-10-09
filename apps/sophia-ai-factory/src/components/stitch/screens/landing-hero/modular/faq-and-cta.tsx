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
      <section className="py-24 border-t border-white/[0.08] bg-[#0A0C14]">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-3">
              FAQ
            </h2>
            <h3 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              {tLanding('faq.title')}
            </h3>
          </div>

          <div className="space-y-4">
            {faqList.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-white/[0.08] bg-[#11131E]/80 overflow-hidden transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(idx)}
                    className="w-full flex items-center justify-between p-5 text-left text-base font-bold text-white hover:text-indigo-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#11131E]"
                    aria-expanded={isOpen}
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={cn(
                        'w-5 h-5 text-slate-400 transition-transform duration-200',
                        isOpen && 'rotate-180 text-indigo-400'
                      )}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-sm text-slate-300 leading-relaxed border-t border-white/[0.05] pt-4">
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
      <section className="py-24 border-t border-white/[0.08] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-indigo-950/20 to-transparent pointer-events-none" />
        <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
          <div className="p-8 sm:p-14 rounded-3xl bg-gradient-to-b from-[#141624] to-[#0D0F18] border border-indigo-500/30 shadow-2xl shadow-indigo-950/50">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-300 mx-auto mb-6 shadow-inner">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-4">
              {t('cta.readyTitle')}
            </h3>
            <p className="text-slate-300 text-base sm:text-lg max-w-2xl mx-auto mb-8 leading-relaxed">
              {t('cta.readySubtitle')}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-9 py-4 rounded-xl text-base font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-xl shadow-indigo-500/30 border border-indigo-400/30 transition-all active:scale-[0.98]"
              >
                <span>{t('cta.startFree')}</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/pricing"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-base font-bold text-slate-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 transition-all"
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
