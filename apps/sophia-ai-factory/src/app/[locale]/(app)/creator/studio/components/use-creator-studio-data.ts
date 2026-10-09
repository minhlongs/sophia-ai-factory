'use client';

import { useState, useEffect, useCallback } from 'react';
import type { CreatorTemplate, CreatorStudioStats } from '@/seed/types/creator-marketplace';
import type { WithdrawalWithQr, ActiveQrModalState, TemplateFormData, WithdrawFormData } from './types';
import { INITIAL_TEMPLATE_FORM, INITIAL_WITHDRAW_FORM, NAPAS_BANKS } from './constants';

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
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState<boolean>(false);
  const [submittingTemplate, setSubmittingTemplate] = useState<boolean>(false);
  const [templateForm, setTemplateForm] = useState<TemplateFormData>(INITIAL_TEMPLATE_FORM);

  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState<boolean>(false);
  const [submittingWithdraw, setSubmittingWithdraw] = useState<boolean>(false);
  const [withdrawForm, setWithdrawForm] = useState<WithdrawFormData>(INITIAL_WITHDRAW_FORM);

  const [activeQrModal, setActiveQrModal] = useState<ActiveQrModalState | null>(null);

  const fetchData = useCallback(async () => {
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
    setSubmittingTemplate(true);
    setErrorMsg(null);
    const priceCents = Math.round(parseFloat(templateForm.priceDollars || '0') * 100);

    try {
      const res = await fetch('/api/creator/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: templateForm.title,
          description: templateForm.description || undefined,
          niche: templateForm.niche,
          targetPlatform: templateForm.targetPlatform,
          aspectRatio: templateForm.aspectRatio,
          hookStyle: templateForm.hookStyle,
          scriptTemplate: templateForm.scriptTemplate,
          visualStylePrompt: templateForm.visualStylePrompt,
          musicPrompt: templateForm.musicPrompt || undefined,
          priceCents,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || 'Failed to submit template');
      }

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
    setSubmittingWithdraw(true);
    setErrorMsg(null);
    const amountCents = Math.round(parseFloat(withdrawForm.amountDollars || '0') * 100);

    try {
      const res = await fetch('/api/creator/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountCents,
          rail: withdrawForm.rail,
          destinationAddress: withdrawForm.rail === 'USDT' ? withdrawForm.destinationAddress : undefined,
          bankBin: withdrawForm.rail === 'VIETQR' ? withdrawForm.bankBin : undefined,
          bankAccountNumber: withdrawForm.rail === 'VIETQR' ? withdrawForm.bankAccountNumber : undefined,
          bankAccountName: withdrawForm.rail === 'VIETQR' ? withdrawForm.bankAccountName : undefined,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || 'Withdrawal failed');
      }

      const result = (await res.json()) as {
        vietQr?: { qrUrl: string; amountVnd: number; amountUsd: number } | null;
      };

      setIsWithdrawModalOpen(false);
      await fetchData();

      if (result.vietQr) {
        setActiveQrModal({
          qrUrl: result.vietQr.qrUrl,
          amountVnd: result.vietQr.amountVnd,
          amountUsd: result.vietQr.amountUsd,
          bankName: NAPAS_BANKS.find((b) => b.bin === withdrawForm.bankBin)?.short || 'NAPAS',
          accountNumber: withdrawForm.bankAccountNumber,
        });
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
