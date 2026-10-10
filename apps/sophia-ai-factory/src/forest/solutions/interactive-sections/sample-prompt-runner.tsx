'use client';

/**
 * Interactive Sample Video Prompt Section
 *
 * Layer: forest/solutions/interactive-sections
 */

import React, { useState } from 'react';
import {
  Copy,
  Check,
  Send,
  Sparkles,
} from 'lucide-react';
import type { SolutionIndustry } from '@/seed/types/solutions-types';

interface SamplePromptRunnerProps {
  industry: SolutionIndustry;
  isVi: boolean;
}

export function SamplePromptRunner({ industry, isVi }: SamplePromptRunnerProps) {
  const [copied, setCopied] = useState(false);

  const samplePrompt = isVi ? industry.samplePromptVi : industry.samplePromptEn;
  const telegramUrl = `https://t.me/Sophia_Bbot?start=sol_${industry.slug}`;

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(samplePrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <section className="rounded-2xl border border-emerald-500/20 bg-zinc-900/80 p-6 sm:p-8 backdrop-blur-md relative overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            {isVi ? 'Mẫu Prompt Kịch Bản Thực Tế' : 'Ready-To-Run Production Prompt'}
          </div>
          <h3 className="text-xl font-bold text-white">
            {isVi ? industry.samplePromptTitleVi : industry.samplePromptTitleEn}
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            {isVi
              ? 'Sao chép câu lệnh này để thử nghiệm ngay trên Bot Telegram hoặc trong ứng dụng Sophia AI.'
              : 'Copy this prompt to test immediately in the Telegram Bot demo or your Sophia AI studio.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copyPrompt}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition shadow-sm"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">{isVi ? 'Đã sao chép!' : 'Copied!'}</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>{isVi ? 'Sao chép prompt' : 'Copy prompt'}</span>
              </>
            )}
          </button>

          <a
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold transition shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isVi ? 'Chạy thử trên Telegram' : 'Run on Telegram Demo'}</span>
          </a>
        </div>
      </div>

      <div className="mt-5 p-4 rounded-xl bg-zinc-950/70 border border-zinc-800/80 font-mono text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
        {samplePrompt}
      </div>
    </section>
  );
}
