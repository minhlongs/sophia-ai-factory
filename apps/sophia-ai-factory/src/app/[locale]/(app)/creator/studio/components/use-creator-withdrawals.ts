'use client';

import { useState, useCallback } from 'react';
import {
  CREATOR_MARKETPLACE_V2_ENABLED,
  MARKETPLACE_TEMPORARILY_UNAVAILABLE_MESSAGE,
} from '@/land/sop-marketplace/availability';
import type { WithdrawFormData, ActiveQrModalState } from './types';
import { INITIAL_WITHDRAW_FORM } from './constants';
import { postCreatorWithdrawal } from './creator-studio-api';
import { getMaintenanceErrorMessage } from './creator-studio-fetcher';

interface UseCreatorWithdrawalsInput {
  isVi: boolean;
  setErrorMsg: React.Dispatch<React.SetStateAction<string | null>>;
  fetchData: () => Promise<void>;
}

interface UseCreatorWithdrawalsOutput {
  isWithdrawModalOpen: boolean;
  setIsWithdrawModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  submittingWithdraw: boolean;
  withdrawForm: WithdrawFormData;
  setWithdrawForm: React.Dispatch<React.SetStateAction<WithdrawFormData>>;
  activeQrModal: ActiveQrModalState | null;
  setActiveQrModal: React.Dispatch<React.SetStateAction<ActiveQrModalState | null>>;
  handleCreateWithdrawal: (e: React.FormEvent) => Promise<void>;
}

export function useCreatorWithdrawals({
  isVi,
  setErrorMsg,
  fetchData,
}: UseCreatorWithdrawalsInput): UseCreatorWithdrawalsOutput {
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState<boolean>(false);
  const [submittingWithdraw, setSubmittingWithdraw] = useState<boolean>(false);
  const [withdrawForm, setWithdrawForm] = useState<WithdrawFormData>(INITIAL_WITHDRAW_FORM);
  const [activeQrModal, setActiveQrModal] = useState<ActiveQrModalState | null>(null);

  const handleCreateWithdrawal = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!CREATOR_MARKETPLACE_V2_ENABLED) {
      setErrorMsg(
        getMaintenanceErrorMessage(isVi, MARKETPLACE_TEMPORARILY_UNAVAILABLE_MESSAGE)
      );
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
  }, [isVi, withdrawForm, setErrorMsg, fetchData]);

  return {
    isWithdrawModalOpen,
    setIsWithdrawModalOpen,
    submittingWithdraw,
    withdrawForm,
    setWithdrawForm,
    activeQrModal,
    setActiveQrModal,
    handleCreateWithdrawal,
  };
}