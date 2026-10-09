/**
 * Viral Script Breakdown Viewer Component
 *
 * Layer: Forest (UI components & coordinators)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module forest/growth/viral-funnel/script-breakdown-card
 */

import React from 'react';
import { Copy, Check } from 'lucide-react';
import type { ViralScript } from '@/seed/types/growth';

interface ScriptBreakdownCardProps {
  script: ViralScript;
  isVi: boolean;
  copiedKey: string | null;
  copyToClipboard: (text: string, key: string) => Promise<void>;
}

export function ScriptBreakdownCard({
  script,
  isVi,
  copiedKey,
  copyToClipboard,
}: ScriptBreakdownCardProps) {
  return (
    <div className="space-y-3 border-t border-neutral-800 pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
          {isVi
            ? `Kịch Bản Hoàn Chỉnh (${script.targetDurationSec} Giây):`
            : `Complete Script (${script.targetDurationSec}s):`}
        </h3>
        <span className="text-xs text-neutral-500">
          {isVi ? script.titleVi : script.title}
        </span>
      </div>

      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
        {script.sections.map((sec, idx) => (
          <div
            key={idx}
            className="p-3 rounded-lg bg-neutral-800/60 border border-neutral-800 text-xs space-y-1"
          >
            <div className="flex items-center justify-between text-neutral-400">
              <span className="font-semibold uppercase text-emerald-400">
                {idx + 1}. {sec.section.toUpperCase()} ({sec.durationSec}s)
              </span>
              <span className="text-[10px] text-neutral-500 italic">
                Visual: {sec.visualCue}
              </span>
            </div>
            <p className="text-white font-medium">
              {isVi ? sec.narrationVi : sec.narration}
            </p>
          </div>
        ))}
      </div>

      {/* Funnel Link Injection Preview */}
      <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-neutral-400">
            {isVi ? 'Link Funnel Tự Động Gắn Mã:' : 'Injected Tracking Links:'}
          </span>
          <button
            onClick={() => copyToClipboard(script.ctaActionUrl, 'active_script_url')}
            className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
          >
            {copiedKey === 'active_script_url' ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            {isVi ? 'Sao Chép' : 'Copy'}
          </button>
        </div>
        <div className="text-[11px] text-neutral-400 font-mono truncate">
          {script.ctaActionUrl}
        </div>
      </div>
    </div>
  );
}
