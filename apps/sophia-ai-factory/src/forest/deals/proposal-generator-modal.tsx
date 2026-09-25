'use client';

/**
 * Bilingual Enterprise Solution Proposal Generator Modal
 *
 * Layer: forest/deals (UI presentation)
 *
 * @module forest/deals/proposal-generator-modal
 */

import React, { useState } from 'react';
import { X, Copy, Check, FileText, Globe, CheckCircle2, Download, Sparkles } from 'lucide-react';
import type { EnterpriseDeal, EnterpriseProposalResult, ProposalLanguage } from '@/seed/types/enterprise-deal';

interface ProposalGeneratorModalProps {
  deal: EnterpriseDeal;
  proposal: EnterpriseProposalResult | null;
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (language: ProposalLanguage) => Promise<void>;
  isLoading?: boolean;
}

export function ProposalGeneratorModal({
  deal,
  proposal,
  isOpen,
  onClose,
  onGenerate,
  isLoading = false,
}: ProposalGeneratorModalProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<ProposalLanguage>('en');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    if (!proposal?.fullMarkdown) return;
    await navigator.clipboard.writeText(proposal.fullMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!proposal?.fullMarkdown) return;
    const blob = new Blob([proposal.fullMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Sophia-Enterprise-Proposal-${deal.companyDomain}-${selectedLanguage}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl flex flex-col overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4 bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                Bilingual Enterprise Solution Proposal
              </h2>
              <p className="text-xs text-zinc-400">
                {deal.companyName} • Target: APAC Video Automation & Dedicated GPU Lanes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {proposal && (
              <>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy Markdown'}
                </button>
                <button
                  onClick={handleDownload}
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

        {/* Control Bar */}
        <div className="flex items-center justify-between px-6 py-3 bg-zinc-950/60 border-b border-zinc-800 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-zinc-400 font-medium flex items-center gap-1">
              <Globe className="w-3.5 h-3.5" /> Proposal Language:
            </span>
            <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5">
              <button
                onClick={() => setSelectedLanguage('en')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                  selectedLanguage === 'en'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                English (EN)
              </button>
              <button
                onClick={() => setSelectedLanguage('vi')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                  selectedLanguage === 'vi'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Tiếng Việt (VI)
              </button>
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

        {/* Proposal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {!proposal ? (
            <div className="text-center py-16 space-y-4">
              <FileText className="w-12 h-12 mx-auto text-zinc-600" />
              <div>
                <h3 className="text-base font-medium text-white">Ready to Generate Custom Proposal</h3>
                <p className="text-xs text-zinc-400 max-w-md mx-auto mt-1">
                  Generates an executive, 7-section publication proposal tailored to {deal.companyName}&apos;s volume requirements and APAC market footprint.
                </p>
              </div>
            </div>
          ) : (
            <div className="prose prose-invert max-w-none space-y-4 text-zinc-200">
              <div className="p-6 rounded-xl bg-zinc-950 border border-zinc-800 font-mono text-xs whitespace-pre-wrap leading-relaxed overflow-x-auto selection:bg-blue-500/30">
                {proposal.fullMarkdown}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-3 bg-zinc-950 text-xs text-zinc-400">
          <span>Enterprise Deal Reference: {deal.id}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
