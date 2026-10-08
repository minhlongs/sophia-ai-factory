// src/components/growth-triad-v8/cohort-ltv-cockpit.tsx

'use client';

import React from 'react';
import type { CohortLtvReport } from '@/seed/types/growth-triad-v8-types';

export function CohortLtvCockpit({ data }: { data: CohortLtvReport }) {
  // Use Tailwind Emerald theme
  return (
    <div className="rounded-xl border border-emerald-500/20 bg-black/60 backdrop-blur tracking-tight shadow-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-medium text-emerald-500">Cohort Monetization Dynamics</h2>
        <span className="px-2 py-0.5 rounded text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          LTV_DECAY
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 rounded-lg bg-black/40 border border-white/5">
          <div className="text-sm text-gray-500 mb-1">Cumulative LTV</div>
          <div className="text-3xl font-light text-white">${data.cumulativeLtvUsd.toLocaleString()}</div>
          <div className="text-xs text-emerald-400 mt-1">Cohort {data.cohortMonth}</div>
        </div>
        <div className="p-4 rounded-lg bg-black/40 border border-white/5">
          <div className="text-sm text-gray-500 mb-1">Peak Churn Hazard</div>
          <div className="text-3xl font-light text-white">Mo {data.churnHazardPeakMonth}</div>
          <div className="text-xs text-rose-400 mt-1">Critical Retention Zone</div>
        </div>
      </div>

      <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 mb-6">
        <div className="text-xs text-emerald-400/80 mb-1 font-mono uppercase tracking-wider">Prescribed AI Intervention</div>
        <p className="text-sm text-emerald-100">{data.recommendedAction}</p>
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-400 mb-3">6-Month Survival Outlook</h3>
        <div className="space-y-2">
          {data.survivalCurve.slice(0, 6).map((proj) => (
            <div key={proj.monthIndex} className="flex items-center text-sm">
              <div className="w-12 font-mono text-gray-500">M{proj.monthIndex}</div>
              <div className="flex-1 max-w-md mx-4 h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full ${proj.monthIndex === data.churnHazardPeakMonth ? 'bg-rose-500' : 'bg-emerald-500'}`}
                  style={{ width: `${proj.survivalProbability * 100}%` }}
                />
              </div>
              <div className="w-16 text-right font-mono text-gray-400">
                {(proj.survivalProbability * 100).toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
