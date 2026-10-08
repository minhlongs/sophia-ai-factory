// src/components/growth-triad-v8/community-bait-cockpit.tsx

'use client';

import React from 'react';
import type { CommunityBaitCampaign } from '@/seed/types/growth-triad-v8-types';

export function CommunityBaitCockpit({ data }: { data: CommunityBaitCampaign }) {
  // Use Tailwind Sky theme
  return (
    <div className="rounded-xl border border-sky-500/20 bg-black/60 backdrop-blur tracking-tight shadow-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-medium text-sky-500">Community Engagement Catalyst</h2>
        <span className="px-2 py-0.5 rounded text-xs font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20">
          VIRAL_BAIT
        </span>
      </div>

      <div className="p-4 rounded-lg bg-sky-500/10 border border-sky-500/20 mb-6">
        <div className="text-sm text-sky-400/80 mb-2 font-medium">Primary Discussion Hook</div>
        <p className="text-lg text-white leading-relaxed">
          &quot;{data.primaryHook.hookQuestion}&quot;
        </p>
        <div className="flex gap-4 mt-3 pt-3 border-t border-sky-500/10">
          <div>
            <span className="text-xs text-gray-500">Curiosity Gap:</span>
            <span className="ml-1 text-sm text-sky-300 font-mono">{data.primaryHook.curiosityGapScore.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-xs text-gray-500">Est. Velocity:</span>
            <span className="ml-1 text-sm text-sky-300 font-mono">{data.primaryHook.estimatedCommentVelocity} cmts/hr</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-300">Alternative A/B Hooks</h3>
        {data.alternativeHooks.map((hook, idx) => (
          <div key={idx} className="p-3 rounded bg-white/5 border border-white/5 hover:border-sky-500/30 transition-colors">
            <p className="text-sm text-gray-300 mb-2">&quot;{hook.hookQuestion}&quot;</p>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-gray-500">Gap: {hook.curiosityGapScore.toFixed(2)}</span>
              {hook.brandSafetyPassed && (
                <span className="text-emerald-500">✓ Brand Safe</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
