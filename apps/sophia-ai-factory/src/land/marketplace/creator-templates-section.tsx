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
import type { CreatorTemplateItem, CreatorBalanceSummary } from '@/tree/marketplace/types';
import type { MarketplaceBlueprintItem } from '@/seed/types/creator-marketplace';
import { CreatorTemplateCard } from './creator-template-card';
import { CreatorRoyaltyWidget } from './creator-royalty-widget';
import { TemplateSubmitModal } from './template-submit-modal';
import { MarketplaceCatalog } from './marketplace-catalog';
import {
  CreatorTemplatesToolbar,
  CreatorTemplatesEmptyState,
} from './creator-templates-toolbar';

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
      {currentUserId && (
        <CreatorRoyaltyWidget
          initialBalance={royaltyBalance}
          creatorId={currentUserId}
        />
      )}

      <CreatorTemplatesToolbar
        activeTab={activeTab}
        totalTemplates={totalTemplates}
        totalBlueprints={totalBlueprints}
        onSelectTab={setActiveTab}
        onOpenSubmitModal={() => setIsSubmitModalOpen(true)}
      />

      {activeTab === 'templates' ? (
        templates.length === 0 ? (
          <CreatorTemplatesEmptyState onOpenSubmitModal={() => setIsSubmitModalOpen(true)} />
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

      <TemplateSubmitModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
      />
    </div>
  );
}
