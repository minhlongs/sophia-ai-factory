import React from 'react';
import { Link } from '@/navigation';
import { PRIMARY_SOLUTIONS } from '@/seed/config/solutions-catalog';
import { ArrowRight } from 'lucide-react';

export interface SolutionsDirectoryGridProps {
  isVi: boolean;
}

export function SolutionsDirectoryGrid({ isVi }: SolutionsDirectoryGridProps) {
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {PRIMARY_SOLUTIONS.map((industry) => (
          <Link
            key={industry.slug}
            href={`/solutions/${industry.slug}`}
            className="group rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 hover:border-emerald-500/40 hover:bg-zinc-900/80 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                  {industry.category}
                </span>
                <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  {isVi ? 'Xem chi tiết' : 'Explore'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>

              <h3 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">
                {isVi ? industry.nameVi : industry.nameEn}
              </h3>

              <p className="text-xs text-zinc-400 mt-2 line-clamp-2 leading-relaxed">
                {isVi ? industry.heroHeadlineVi : industry.heroHeadlineEn}
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-500">
              <span>{isVi ? 'Xuất video 60s' : '60s generation'}</span>
              <span className="text-zinc-400 font-mono">
                ${industry.roiComparison.sophiaMonthlyUsd}/mo
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
