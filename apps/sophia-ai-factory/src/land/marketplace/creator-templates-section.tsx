'use client';

/**
 * Creator Templates Marketplace Section
 *
 * Layer: land (pure UI component)
 *
 * Provides tabbed browsing between Video Blueprints and Creator Templates,
 * interactive template submission with AI virality scoring, and royalty payout management.
 *
 * @module land/marketplace/creator-templates-section
 */

import React, { useState } from 'react';
import {
  Sparkles,
  Layers,
  Plus,
} from 'lucide-react';
import type { CreatorTemplateItem, CreatorBalanceSummary } from '@/tree/marketplace/types';
import type { MarketplaceBlueprintItem } from '@/seed/types/creator-marketplace';
import { CreatorTemplateCard } from './creator-template-card';
import { CreatorRoyaltyWidget } from './creator-royalty-widget';
import { TemplateSubmitModal } from './template-submit-modal';
import { MarketplaceCatalog } from './marketplace-catalog';

export interface CreatorTemplatesSectionProps {
  blueprints: MarketplaceBlueprintItem[];
  totalBlueprints: number;
  templates: CreatorTemplateItem[];
  totalTemplates: number;
  page: number;
  pageSize: number;
  totalPages: number;
  currentUserId?: string;
  royaltyBalance?: CreatorBalanceSummary | null;
}

export function CreatorTemplatesSection({
  blueprints,
  totalBlueprints,
  templates,
  totalTemplates,
  page,
  pageSize,
  totalPages,
  currentUserId,
  royaltyBalance,
}: CreatorTemplatesSectionProps) {
  const [activeTab, setActiveTab] = useState<'templates' | 'blueprints'>('templates');
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Royalty Smart Ledger Bar for Authenticated Creators */}
      {currentUserId && (
        <CreatorRoyaltyWidget
          initialBalance={royaltyBalance}
          creatorId={currentUserId}
        />
      )}

      {/* Tabs & Submit Button Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('templates')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
              activeTab === 'templates'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            Creator Blueprints ({totalTemplates})
          </button>
          <button
            onClick={() => setActiveTab('blueprints')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
              activeTab === 'blueprints'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
            }`}
          >
            <Layers className="h-4 w-4" />
            AI Video Recipes ({totalBlueprints})
          </button>
        </div>

        <button
          onClick={() => setIsSubmitModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-lg transition hover:from-indigo-400 hover:to-purple-500 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Submit Blueprint (Earn 70%)
        </button>
      </div>

      {/* Active Tab Content */}
      {activeTab === 'templates' ? (
        templates.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#12131A] p-12 text-center">
            <Sparkles className="mx-auto h-12 w-12 text-indigo-400 opacity-60" />
            <h3 className="mt-4 text-base font-bold text-foreground">No Creator Templates Found</h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
              Be the first creator to monetize your viral video blueprints. Submit your script and earn 70% royalties on every activation.
            </p>
            <button
              onClick={() => setIsSubmitModalOpen(true)}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-indigo-500 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Submit First Blueprint
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {templates.map((tpl) => (
              <CreatorTemplateCard
                key={tpl.id}
                template={tpl}
                currentUserId={currentUserId}
              />
            ))}
          </div>
        )
      ) : (
        <MarketplaceCatalog
          blueprints={blueprints}
          total={totalBlueprints}
          page={page}
          pageSize={pageSize}
          totalPages={totalPages}
        />
      )}

      {/* Submission Modal */}
      <TemplateSubmitModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
      />
    </div>
  );
}
