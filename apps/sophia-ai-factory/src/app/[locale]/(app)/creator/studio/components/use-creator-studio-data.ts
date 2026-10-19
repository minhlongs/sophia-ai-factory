'use client';

import { useCreatorStudioOverview } from './use-creator-studio-overview';
import { useCreatorTemplates } from './use-creator-templates';
import { useCreatorWithdrawals } from './use-creator-withdrawals';

export {
  INITIAL_STUDIO_STATS,
  fetchCreatorStudioOverview,
  getMaintenanceErrorMessage,
} from './creator-studio-fetcher';

export function useCreatorStudioData(isVi: boolean) {
  const overview = useCreatorStudioOverview({ isVi });
  const templates = useCreatorTemplates({
    isVi,
    setErrorMsg: overview.setErrorMsg,
    fetchData: overview.fetchData,
  });
  const withdrawals = useCreatorWithdrawals({
    isVi,
    setErrorMsg: overview.setErrorMsg,
    fetchData: overview.fetchData,
  });

  return {
    ...overview,
    ...templates,
    ...withdrawals,
  };
}