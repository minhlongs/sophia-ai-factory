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

export function useCreatorStudioData(isVi: boolean) {
  const [stats, setStats] = useState<CreatorStudioStats>({
    totalTemplates: 0,
    totalUses: 0,
    grossEarningsCents: 0,
    creatorRoyaltyCents: 0,
    platformFeesCents: 0,
    availableBalanceCents: 0,
    pendingBalanceCents: 0,
    averageRating: 0,
    totalReviews: 0,
  });

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
      const [tmplRes, withRes] = await Promise.all([
        fetch('/api/creator/templates'),
        fetch('/api/creator/withdrawals'),
      ]);

      if (tmplRes.ok) {
        const tmplData = (await tmplRes.json()) as { templates: CreatorTemplate[]; total: number };
        setTemplates(tmplData.templates || []);
      }

      if (withRes.ok) {
        const withData = (await withRes.json()) as {
          withdrawals: WithdrawalWithQr[];
          balances?: { availableCents: number; unencumberedCents: number };
        };
        setWithdrawals(withData.withdrawals || []);
        if (withData.balances) {
          setStats((prev) => ({
            ...prev,
            availableBalanceCents: withData.balances?.unencumberedCents ?? prev.availableBalanceCents,
          }));
        }
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
      setErrorMsg(
        isVi
          ? 'Creator Marketplace tạm thời bảo trì. Vui lòng quay lại sau.'
          : MARKETPLACE_TEMPORARILY_UNAVAILABLE_MESSAGE,
      );
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
      setErrorMsg(
        isVi
          ? 'Creator Marketplace tạm thời bảo trì. Vui lòng quay lại sau.'
          : MARKETPLACE_TEMPORARILY_UNAVAILABLE_MESSAGE,
      );
      return;
    }
    setSubmittingWithdraw(true);
    setErrorMsg(null);

    try {
      const qrModal = await postCreatorWithdrawal(withdrawForm);
      setIsWithdrawModalOpen(false);
      await fetchData();

      if (qrModal) {
        setActiveQrModal(qrModal);
      }
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
