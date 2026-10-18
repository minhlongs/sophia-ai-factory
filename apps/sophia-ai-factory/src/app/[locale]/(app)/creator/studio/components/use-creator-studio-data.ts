'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CREATOR_MARKETPLACE_V2_ENABLED,
  MARKETPLACE_TEMPORARILY_UNAVAILABLE_MESSAGE,
} from '@/land/sop-marketplace/availability';
import type { CreatorTemplate, CreatorStudioStats } from '@/seed/types/creator-marketplace';
import type { WithdrawalWithQr, ActiveQrModalState, TemplateFormData, WithdrawFormData } from './types';
import { INITIAL_TEMPLATE_FORM, INITIAL_WITHDRAW_FORM } from './constants';
import { postCreatorTemplate, postCreatorWithdrawal } from './creator-studio-api';
import {
  INITIAL_STUDIO_STATS,
  fetchCreatorStudioOverview,
  getMaintenanceErrorMessage,
} from './creator-studio-fetcher';

export {
  INITIAL_STUDIO_STATS,
  fetchCreatorStudioOverview,
  getMaintenanceErrorMessage,
};

export function useCreatorStudioData(isVi: boolean) {
  const [stats, setStats] = useState<CreatorStudioStats>(INITIAL_STUDIO_STATS);
  const [templates, setTemplates] = useState<CreatorTemplate[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalWithQr[]>([]);
  const [loading, setLoading] = useState<boolean>(CREATOR_MARKETPLACE_V2_ENABLED);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState<boolean>(false);
  const [submittingTemplate, setSubmittingTemplate] = useState<boolean>(false);
  const [templateForm, setTemplateForm] = useState<TemplateFormData>(INITIAL_TEMPLATE_FORM);

  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState<boolean>(false);
  const [submittingWithdraw, setSubmittingWithdraw] = useState<boolean>(false);
  const [withdrawForm, setWithdrawForm] = useState<WithdrawFormData>(INITIAL_WITHDRAW_FORM);

  const [activeQrModal, setActiveQrModal] = useState<ActiveQrModalState | null>(null);

  const fetchData = useCallback(async () => {
    if (!CREATOR_MARKETPLACE_V2_ENABLED) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const overview = await fetchCreatorStudioOverview();
      if (overview.templates) setTemplates(overview.templates);
      if (overview.withdrawals) setWithdrawals(overview.withdrawals);
      if (overview.unencumberedCents !== undefined) {
        setStats((prev) => ({
          ...prev,
          availableBalanceCents: overview.unencumberedCents ?? prev.availableBalanceCents,
        }));
      }
    } catch (_err) {
      setErrorMsg(isVi ? 'Không thể tải dữ liệu phòng sáng tạo.' : 'Failed to load studio data.');
    } finally {
      setLoading(false);
    }
  }, [isVi]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!CREATOR_MARKETPLACE_V2_ENABLED) {
      setErrorMsg(getMaintenanceErrorMessage(isVi, MARKETPLACE_TEMPORARILY_UNAVAILABLE_MESSAGE));
      return;
    }
    setSubmittingTemplate(true);
    setErrorMsg(null);
    try {
      await postCreatorTemplate(templateForm);
      setIsTemplateModalOpen(false);
      setTemplateForm(INITIAL_TEMPLATE_FORM);
      await fetchData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmittingTemplate(false);
    }
  };

  const handleCreateWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!CREATOR_MARKETPLACE_V2_ENABLED) {
      setErrorMsg(getMaintenanceErrorMessage(isVi, MARKETPLACE_TEMPORARILY_UNAVAILABLE_MESSAGE));
      return;
    }
    setSubmittingWithdraw(true);
    setErrorMsg(null);
    try {
      const qrModal = await postCreatorWithdrawal(withdrawForm);
      setIsWithdrawModalOpen(false);
      await fetchData();
      if (qrModal) setActiveQrModal(qrModal);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Withdrawal submission failed');
    } finally {
      setSubmittingWithdraw(false);
    }
  };

  return {
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
    fetchData,
    handleCreateTemplate,
    handleCreateWithdrawal,
  };
}
