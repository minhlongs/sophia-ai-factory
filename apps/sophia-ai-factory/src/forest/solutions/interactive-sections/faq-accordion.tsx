'use client';

/**
 * Interactive FAQ Accordion Section
 *
 * Layer: forest/solutions/interactive-sections
 */

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { SolutionIndustry } from '@/seed/types/solutions-types';

interface FaqAccordionProps {
  industry: SolutionIndustry;
  isVi: boolean;
}

export function FaqAccordion({ industry, isVi }: FaqAccordionProps) {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-8 backdrop-blur-md">
      <div className="text-center max-w-xl mx-auto mb-8">
        <h3 className="text-2xl font-bold text-white tracking-tight">
          {isVi ? 'Câu Hỏi Thường Gặp' : 'Frequently Asked Questions'}
        </h3>
        <p className="text-xs text-zinc-400 mt-1">
          {isVi
            ? `Giải đáp chi tiết về giải pháp video AI cho ngành ${industry.nameVi}.`
            : `Everything you need to know about Sophia AI for ${industry.nameEn}.`}
        </p>
      </div>

      <div className="max-w-3xl mx-auto space-y-3">
        {industry.faqs.map((faq, index) => {
          const isOpen = openFaqIndex === index;
          const q = isVi ? faq.questionVi : faq.questionEn;
          const a = isVi ? faq.answerVi : faq.answerEn;

          return (
            <div
              key={index}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden transition"
            >
              <button
                onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                className="w-full p-4 text-left flex items-center justify-between text-sm font-semibold text-zinc-200 hover:text-white transition"
              >
                <span>{q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${
                    isOpen ? 'transform rotate-180 text-emerald-400' : ''
                  }`}
                />
              </button>
              {isOpen && (
                <div className="px-4 pb-4 text-xs text-zinc-400 leading-relaxed border-t border-zinc-800/60 pt-3">
                  {a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
