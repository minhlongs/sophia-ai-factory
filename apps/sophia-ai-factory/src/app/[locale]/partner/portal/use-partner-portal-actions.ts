'use client';

import { useTransition } from 'react';
import {
  registerPartnerAction,
  configureWhitelabelAction,
} from '@/land/partners/partner-actions';
import type { usePartnerPortalState } from './use-partner-portal-state';
import { runVerifyDns, runRequestPayout } from './partner-portal-action-helpers';

export { runVerifyDns, runRequestPayout };

export function usePartnerPortalActions(
  state: ReturnType<typeof usePartnerPortalState>,
  isVi: boolean,
) {
  const [isPending, startTransition] = useTransition();

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    state.setRegisterError(null);
    startTransition(async () => {
      const res = await registerPartnerAction({
        partnerName: state.registerName,
        partnerType: state.registerType,
        referralCode: state.registerCode.trim() || undefined,
      });

      if (res.ok) {
        state.setDashboard({
          profile: res.value,
          nextTier: {
            targetTier: 'GOLD',
            customersRemaining: 5,
            mrrRemainingCents: 300000,
            progressPct: 0,
          },
          recentCommissions: [],
          whitelabelConfig: null,
        });
      } else {
        state.setRegisterError(res.error.message);
      }
    });
  };

  const handleSaveWhitelabel = (e: React.FormEvent) => {
    e.preventDefault();
    state.setWlSuccessMsg(null);
    state.setWlErrorMsg(null);
    startTransition(async () => {
      const res = await configureWhitelabelAction({
        brandName: state.wlBrandName,
        customDomain: state.wlDomain.trim() || undefined,
        primaryColor: state.wlPrimaryColor,
        accentColor: state.wlAccentColor,
        logoUrl: state.wlLogoUrl.trim() || undefined,
        supportUrl: state.wlSupportUrl.trim() || undefined,
      });

      if (res.ok) {
        state.setWlSuccessMsg(isVi ? 'Đã lưu cấu hình nhãn trắng!' : 'White-label configuration saved!');
        if (state.dashboard) {
          state.setDashboard({ ...state.dashboard, whitelabelConfig: res.value });
        }
      } else {
        state.setWlErrorMsg(res.error.message);
      }
    });
  };

  const handleVerifyDns = () => runVerifyDns(state, isVi, startTransition);
  const handleRequestPayout = (e: React.FormEvent) =>
    runRequestPayout(e, state, isVi, startTransition);

  return {
    isPending,
    handleRegister,
    handleSaveWhitelabel,
    handleVerifyDns,
    handleRequestPayout,
  };
}
