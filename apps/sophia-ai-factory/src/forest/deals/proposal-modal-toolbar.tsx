'use client';

/**
 * Header and language control toolbar for ProposalGeneratorModal.
 * @module forest/deals/proposal-modal-toolbar
 */

import React from 'react';
import { X, Copy, Check, FileText, Globe, CheckCircle2, Download, Sparkles } from 'lucide-react';
import type { EnterpriseDeal, EnterpriseProposalResult, ProposalLanguage } from '@/seed/types/enterprise-deal';

export function ProposalModalHeader({
  deal,
  proposal,
  copied,
  onCopy,
  onDownload,
  onClose,
}: {
  deal: EnterpriseDeal;
  proposal: EnterpriseProposalResult | null;
  copied: boolean;
  onCopy: () => void;
  onDownload: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4 bg-zinc-950">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
          <FileText className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Bilingual Enterprise Solution Proposal</h2>
          <p className="text-xs text-zinc-400">
            {deal.companyName} • Target: APAC Video Automation & Dedicated GPU Lanes
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {proposal && (
          <>
            <button
              onClick={onCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy Markdown'}
            </button>
            <button
              onClick={onDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition"
            >
              <Download className="w-3.5 h-3.5" />
              Download .md
            </button>
          </>
        )}
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

export function ProposalModalControlBar({
  selectedLanguage,
  onSelectLanguage,
  proposal,
  isLoading,
  onGenerate,
}: {
  selectedLanguage: ProposalLanguage;
  onSelectLanguage: (lang: ProposalLanguage) => void;
  proposal: EnterpriseProposalResult | null;
  isLoading: boolean;
  onGenerate: (lang: ProposalLanguage) => void;
}) {
  return (
    <div className="flex items-center justify-between px-6 py-3 bg-zinc-950/60 border-b border-zinc-800 text-xs">
      <div className="flex items-center gap-3">
        <span className="text-zinc-400 font-medium flex items-center gap-1">
          <Globe className="w-3.5 h-3.5" /> Proposal Language:
        </span>
        <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5">
          {(['en', 'vi'] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => onSelectLanguage(lang)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                selectedLanguage === lang ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {lang === 'en' ? 'English (EN)' : 'Tiếng Việt (VI)'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {proposal && (
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[11px]">
              {proposal.wordCount.toLocaleString()} words
            </span>
            {proposal.qualityPassed && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-medium">
                <CheckCircle2 className="w-3 h-3" /> 7/7 Sections Certified
              </span>
            )}
          </div>
        )}
        <button
          onClick={() => onGenerate(selectedLanguage)}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium disabled:opacity-50 transition"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {isLoading ? 'Generating Proposal...' : 'Generate Proposal'}
        </button>
      </div>
    </div>
  );
}
