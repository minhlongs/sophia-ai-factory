'use client';

/**
 * Bilingual Creator Studio Portal
 *
 * Route: /[locale]/(app)/creator/studio
 * Accessible at: /creator/studio, /vi/creator/studio, /en/creator/studio
 *
 * Implements Milestone 2 (R2):
 * - Autonomous Creator Marketplace & 70/30 Royalty Protocol
 * - Template Registry, Review Statuses & Quality Ratings
 * - OCC CAS Ledger Earnings & Balances
 * - Dual-Rail Withdrawals: Web3 USDT (TRC-20) & Vietnam Domestic VietQR (NAPAS 247)
 *
 * @module app/[locale]/(app)/creator/studio/page
 */

import React, { useState, use } from 'react';
import { AlertCircle } from 'lucide-react';
import { MarketplaceUnavailableNotice } from '@/components/sop-marketplace/marketplace-unavailable-notice';
import { CREATOR_MARKETPLACE_V2_ENABLED } from '@/land/sop-marketplace/availability';
import {
  type PageProps,
  useCreatorStudioData,
  StudioStatsHeader,
} from './components';
import {
  type StudioTabKey,
  StudioTabsSection,
  StudioModalsSection,
} from './studio-tabs-and-modals';

export default function CreatorStudioPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const locale = resolvedParams.locale === 'vi' ? 'vi' : 'en';
  const isVi = locale === 'vi';

  const [activeTab, setActiveTab] = useState<StudioTabKey>('templates');

  const {
    stats,
    templates,
    withdrawals,
    loading,
    errorMsg,
    isTemplateModalOpen,
    setIsTemplateModalOpen,
    submittingTemplate,
    templateForm,
    setTemplateForm,
    isWithdrawModalOpen,
    setIsWithdrawModalOpen,
    submittingWithdraw,
    withdrawForm,
    setWithdrawForm,
    activeQrModal,
    setActiveQrModal,
    handleCreateTemplate,
    handleCreateWithdrawal,
  } = useCreatorStudioData(isVi);

  if (!CREATOR_MARKETPLACE_V2_ENABLED) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-10 space-y-8 max-w-7xl mx-auto">
        <MarketplaceUnavailableNotice />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-10 space-y-8 max-w-7xl mx-auto">
      <StudioStatsHeader
        isVi={isVi}
        stats={stats}
        templates={templates}
        onOpenTemplateModal={() => setIsTemplateModalOpen(true)}
        onOpenWithdrawModal={() => setIsWithdrawModalOpen(true)}
      />

      {errorMsg && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <StudioTabsSection
        isVi={isVi}
        loading={loading}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        templates={templates}
        withdrawals={withdrawals}
        onOpenTemplateModal={() => setIsTemplateModalOpen(true)}
        onOpenQrModal={setActiveQrModal}
      />

      <StudioModalsSection
        isVi={isVi}
        availableBalanceCents={stats.availableBalanceCents}
        isTemplateModalOpen={isTemplateModalOpen}
        submittingTemplate={submittingTemplate}
        templateForm={templateForm}
        onChangeTemplateForm={setTemplateForm}
        onCloseTemplateModal={() => setIsTemplateModalOpen(false)}
        onSubmitTemplate={handleCreateTemplate}
        isWithdrawModalOpen={isWithdrawModalOpen}
        submittingWithdraw={submittingWithdraw}
        withdrawForm={withdrawForm}
        onChangeWithdrawForm={setWithdrawForm}
        onCloseWithdrawModal={() => setIsWithdrawModalOpen(false)}
        onSubmitWithdraw={handleCreateWithdrawal}
        activeQrModal={activeQrModal}
        onCloseQrModal={() => setActiveQrModal(null)}
      />
    </div>
  );
}
