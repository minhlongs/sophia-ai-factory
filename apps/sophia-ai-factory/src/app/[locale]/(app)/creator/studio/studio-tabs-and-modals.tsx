'use client';

/**
 * Creator Studio Tabs & Modals Section
 *
 * @module app/[locale]/(app)/creator/studio/studio-tabs-and-modals
 */

import React from 'react';
import {
  type CreatorTemplate,
  type WithdrawalWithQr,
  type TemplateFormData,
  type WithdrawFormData,
  type ActiveQrModalState,
  TemplatesTab,
  WithdrawalsTab,
  CreateTemplateModal,
  CreateWithdrawalModal,
  VietQrModal,
} from './components';

export type StudioTabKey = 'templates' | 'withdrawals';

export interface StudioTabsSectionProps {
  isVi: boolean;
  loading: boolean;
  activeTab: StudioTabKey;
  onSelectTab: (tab: StudioTabKey) => void;
  templates: CreatorTemplate[];
  withdrawals: WithdrawalWithQr[];
  onOpenTemplateModal: () => void;
  onOpenQrModal: (modalData: ActiveQrModalState | null) => void;
}

export function StudioTabsSection({
  isVi,
  loading,
  activeTab,
  onSelectTab,
  templates,
  withdrawals,
  onOpenTemplateModal,
  onOpenQrModal,
}: StudioTabsSectionProps) {
  return (
    <>
      <div className="flex items-center gap-4 border-b border-zinc-800">
        <button
          onClick={() => onSelectTab('templates')}
          className={`pb-3 font-medium text-sm transition-all border-b-2 ${
            activeTab === 'templates'
              ? 'border-indigo-500 text-indigo-400 font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {isVi ? 'Mẫu Video Của Bạn' : 'My Video Templates'} ({templates.length})
        </button>
        <button
          onClick={() => onSelectTab('withdrawals')}
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
        <TemplatesTab isVi={isVi} loading={loading} templates={templates} onOpenTemplateModal={onOpenTemplateModal} />
      )}
      {activeTab === 'withdrawals' && (
        <WithdrawalsTab isVi={isVi} loading={loading} withdrawals={withdrawals} onOpenQrModal={onOpenQrModal} />
      )}
    </>
  );
}

export interface StudioModalsSectionProps {
  isVi: boolean;
  availableBalanceCents: number;
  isTemplateModalOpen: boolean;
  submittingTemplate: boolean;
  templateForm: TemplateFormData;
  onChangeTemplateForm: React.Dispatch<React.SetStateAction<TemplateFormData>>;
  onCloseTemplateModal: () => void;
  onSubmitTemplate: (e: React.FormEvent) => Promise<void>;
  isWithdrawModalOpen: boolean;
  submittingWithdraw: boolean;
  withdrawForm: WithdrawFormData;
  onChangeWithdrawForm: React.Dispatch<React.SetStateAction<WithdrawFormData>>;
  onCloseWithdrawModal: () => void;
  onSubmitWithdraw: (e: React.FormEvent) => Promise<void>;
  activeQrModal: ActiveQrModalState | null;
  onCloseQrModal: () => void;
}

export function StudioModalsSection(props: StudioModalsSectionProps) {
  return (
    <>
      <CreateTemplateModal
        isVi={props.isVi}
        isOpen={props.isTemplateModalOpen}
        submitting={props.submittingTemplate}
        formData={props.templateForm}
        onChange={props.onChangeTemplateForm}
        onClose={props.onCloseTemplateModal}
        onSubmit={props.onSubmitTemplate}
      />
      <CreateWithdrawalModal
        isVi={props.isVi}
        isOpen={props.isWithdrawModalOpen}
        submitting={props.submittingWithdraw}
        availableBalanceCents={props.availableBalanceCents}
        formData={props.withdrawForm}
        onChange={props.onChangeWithdrawForm}
        onClose={props.onCloseWithdrawModal}
        onSubmit={props.onSubmitWithdraw}
      />
      <VietQrModal isVi={props.isVi} modalData={props.activeQrModal} onClose={props.onCloseQrModal} />
    </>
  );
}
