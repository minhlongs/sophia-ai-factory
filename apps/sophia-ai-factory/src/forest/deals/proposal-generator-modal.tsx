'use client';

/**
 * Bilingual Enterprise Solution Proposal Generator Modal
 *
 * Layer: forest/deals (UI presentation)
 *
 * @module forest/deals/proposal-generator-modal
 */

import React, { useState } from 'react';
import { FileText } from 'lucide-react';
import type { EnterpriseDeal, EnterpriseProposalResult, ProposalLanguage } from '@/seed/types/enterprise-deal';
import { ProposalModalHeader, ProposalModalControlBar } from './proposal-modal-toolbar';

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
        <ProposalModalHeader
          deal={deal}
          proposal={proposal}
          copied={copied}
          onCopy={handleCopy}
          onDownload={handleDownload}
          onClose={onClose}
        />

        <ProposalModalControlBar
          selectedLanguage={selectedLanguage}
          onSelectLanguage={setSelectedLanguage}
          proposal={proposal}
          isLoading={isLoading}
          onGenerate={onGenerate}
        />

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
