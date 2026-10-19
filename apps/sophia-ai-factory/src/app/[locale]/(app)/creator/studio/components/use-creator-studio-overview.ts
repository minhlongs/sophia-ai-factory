'use client';

import { useState, useEffect, useCallback } from 'react';
import { CREATOR_MARKETPLACE_V2_ENABLED } from '@/land/sop-marketplace/availability';
import type { CreatorStudioStats, CreatorTemplate } from '@/seed/types/creator-marketplace';
import type { WithdrawalWithQr } from './types';
import { INITIAL_STUDIO_STATS, fetchCreatorStudioOverview } from './creator-studio-fetcher';

interface UseCreatorStudioOverviewInput {
  isVi: boolean;
}

interface UseCreatorStudioOverviewOutput {
  stats: CreatorStudioStats;
  templates: CreatorTemplate[];
  withdrawals: WithdrawalWithQr[];
  loading: boolean;
  errorMsg: string | null;
  setErrorMsg: React.Dispatch<React.SetStateAction<string | null>>;
  fetchData: () => Promise<void>;
}

export function useCreatorStudioOverview({
  isVi,
}: UseCreatorStudioOverviewInput): UseCreatorStudioOverviewOutput {
  const [stats, setStats] = useState<CreatorStudioStats>(INITIAL_STUDIO_STATS);
  const [templates, setTemplates] = useState<CreatorTemplate[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalWithQr[]>([]);
  const [loading, setLoading] = useState<boolean>(CREATOR_MARKETPLACE_V2_ENABLED);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  return {
    stats,
    templates,
    withdrawals,
    loading,
    errorMsg,
    setErrorMsg,
    fetchData,
  };
}