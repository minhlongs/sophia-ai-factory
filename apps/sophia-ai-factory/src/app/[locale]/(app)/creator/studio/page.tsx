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
import {
  type PageProps,
  useCreatorStudioData,
  StudioStatsHeader,
  TemplatesTab,
  WithdrawalsTab,
  CreateTemplateModal,
  CreateWithdrawalModal,
  VietQrModal,
} from './components';

export default function CreatorStudioPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const locale = resolvedParams.locale === 'vi' ? 'vi' : 'en';
  const isVi = locale === 'vi';

  const [activeTab, setActiveTab] = useState<'templates' | 'withdrawals'>('templates');

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

      {/* Tabs Switcher */}
      <div className="flex items-center gap-4 border-b border-zinc-800">
        <button
          onClick={() => setActiveTab('templates')}
          className={`pb-3 font-medium text-sm transition-all border-b-2 ${
            activeTab === 'templates'
              ? 'border-indigo-500 text-indigo-400 font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {isVi ? 'Mẫu Video Của Bạn' : 'My Video Templates'} ({templates.length})
        </button>
        <button
          onClick={() => setActiveTab('withdrawals')}
          className={`pb-3 font-medium text-sm transition-all border-b-2 ${
            activeTab === 'withdrawals'
              ? 'border-indigo-500 text-indigo-400 font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {isVi ? 'Lịch Sử Rút Tiền' : 'Withdrawal History'} ({withdrawals.length})
        </button>
      </div>

      {activeTab === 'templates' && (
        <TemplatesTab
          isVi={isVi}
          loading={loading}
          templates={templates}
          onOpenTemplateModal={() => setIsTemplateModalOpen(true)}
        />
      )}

      {activeTab === 'withdrawals' && (
        <WithdrawalsTab
          isVi={isVi}
          loading={loading}
          withdrawals={withdrawals}
          onOpenQrModal={setActiveQrModal}
        />
      )}

      <CreateTemplateModal
        isVi={isVi}
        isOpen={isTemplateModalOpen}
        submitting={submittingTemplate}
        formData={templateForm}
        onChange={setTemplateForm}
        onClose={() => setIsTemplateModalOpen(false)}
        onSubmit={handleCreateTemplate}
      />

      <CreateWithdrawalModal
        isVi={isVi}
        isOpen={isWithdrawModalOpen}
        submitting={submittingWithdraw}
        availableBalanceCents={stats.availableBalanceCents}
        formData={withdrawForm}
        onChange={setWithdrawForm}
        onClose={() => setIsWithdrawModalOpen(false)}
        onSubmit={handleCreateWithdrawal}
      />

      <VietQrModal
        isVi={isVi}
        modalData={activeQrModal}
        onClose={() => setActiveQrModal(null)}
      />
    </div>
  );
}
