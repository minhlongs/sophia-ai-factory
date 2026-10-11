import React from 'react';
import { AlertTriangle, Quote, ShieldCheck, Zap } from 'lucide-react';
import type { SolutionFeaturesProps } from './types';

export function SolutionFeatures({ industry, locale }: SolutionFeaturesProps) {
  const isVi = locale === 'vi';

  return (
    <>
      {/* Pain Points vs Solution Grid */}
      <section>
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-semibold mb-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            {isVi ? 'Thách Thức Cốt Lõi' : 'Industry Bottlenecks'}
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {isVi
              ? `3 Rào Cản Khi Làm Video Ngành ${industry.nameVi}`
              : `Top 3 Video Obstacles Facing ${industry.nameEn}`}
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 mt-2">
            {isVi
              ? 'Tại sao hầu hết doanh nghiệp bỏ cuộc trước khi đạt được lượng khách hàng mong muốn.'
              : 'Why traditional video approaches fail to generate consistent high-margin leads.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {industry.painPoints.map((pain, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 flex flex-col justify-between"
            >
              <div>
                <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center font-bold text-sm mb-4 border border-rose-500/20">
                  0{idx + 1}
                </div>
                <h3 className="text-base font-bold text-white mb-2">
                  {isVi ? pain.titleVi : pain.titleEn}
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {isVi ? pain.descVi : pain.descEn}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-zinc-800/80 flex items-center gap-2 text-xs text-emerald-400 font-semibold">
                <Zap className="w-3.5 h-3.5 shrink-0" />
                <span>{isVi ? 'Sophia giải quyết tự động' : 'Solved by Sophia AI'}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonial Quote Section */}
      <section className="rounded-2xl border border-zinc-800 bg-gradient-to-r from-zinc-900/80 via-zinc-900/50 to-zinc-900/80 p-8 sm:p-10 relative overflow-hidden">
        <Quote className="absolute right-6 bottom-4 w-28 h-28 text-zinc-800/30 pointer-events-none" />
        <div className="max-w-3xl relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold mb-4 border border-emerald-500/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{industry.testimonial.metrics}</span>
          </div>
          <blockquote className="text-lg sm:text-xl font-medium text-white italic leading-relaxed">
            &ldquo;{isVi ? industry.testimonial.quoteVi : industry.testimonial.quoteEn}&rdquo;
          </blockquote>
          <div className="mt-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold flex items-center justify-center text-sm">
              {industry.testimonial.author.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-bold text-white">
                {industry.testimonial.author}
              </div>
              <div className="text-xs text-zinc-400">
                {isVi ? industry.testimonial.roleVi : industry.testimonial.roleEn} • {industry.testimonial.company}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
