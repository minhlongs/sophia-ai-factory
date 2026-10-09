'use client';

import { useTransition } from 'react';
import {
  registerPartnerAction,
  requestCommissionPayoutAction,
  configureWhitelabelAction,
  verifyCustomDomainDnsAction,
} from '@/land/partners/partner-actions';
import type { usePartnerPortalState } from './use-partner-portal-state';

export function usePartnerPortalActions(
  state: ReturnType<typeof usePartnerPortalState>,
  isVi: boolean
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

  const handleVerifyDns = () => {
    if (!state.wlDomain.trim()) return;
    state.setDnsVerifyMsg(null);
    startTransition(async () => {
      const res = await verifyCustomDomainDnsAction(state.wlDomain.trim());
      if (res.ok) {
        state.setDnsVerifyMsg(
          res.value.verified
            ? isVi ? 'Xác thực DNS thành công! SSL đã được cấp phát.' : 'DNS verified successfully! SSL provisioned.'
            : isVi ? 'Chưa tìm thấy bản ghi DNS TXT khớp. Vui lòng đợi 5-10 phút.' : 'DNS record not yet propagating. Please wait a few minutes.'
        );
        if (res.value.verified && state.dashboard && state.dashboard.whitelabelConfig) {
          state.setDashboard({
            ...state.dashboard,
            whitelabelConfig: { ...state.dashboard.whitelabelConfig, is_ssl_active: 1 },
          });
        }
      } else {
        state.setDnsVerifyMsg(res.error.message);
      }
    });
  };

  const handleRequestPayout = (e: React.FormEvent) => {
    e.preventDefault();
    state.setPayoutSuccessMsg(null);
    state.setPayoutErrorMsg(null);
    const amountNum = parseFloat(state.payoutAmount);
    if (isNaN(amountNum) || amountNum < 50) {
      state.setPayoutErrorMsg(isVi ? 'Số tiền rút tối thiểu là $50.00' : 'Minimum payout is $50.00');
      return;
    }

    startTransition(async () => {
      const res = await requestCommissionPayoutAction({
        amountCents: Math.round(amountNum * 100),
        payoutRail: state.payoutRail,
        destinationDetails: { address: state.payoutDest },
      });

      if (res.ok) {
        state.setPayoutSuccessMsg(
          isVi
            ? `Yêu cầu rút $${amountNum.toFixed(2)} đã được ghi nhận và đang xử lý.`
            : `Payout request for $${amountNum.toFixed(2)} submitted successfully.`
        );
        if (state.dashboard && state.dashboard.profile) {
          state.setDashboard({
            ...state.dashboard,
            profile: {
              ...state.dashboard.profile,
              pending_payout_cents: Math.max(0, state.dashboard.profile.pending_payout_cents - Math.round(amountNum * 100)),
            },
          });
        }
      } else {
        state.setPayoutErrorMsg(res.error.message);
      }
    });
  };

  return {
    isPending,
    handleRegister,
    handleSaveWhitelabel,
    handleVerifyDns,
    handleRequestPayout,
  };
}
