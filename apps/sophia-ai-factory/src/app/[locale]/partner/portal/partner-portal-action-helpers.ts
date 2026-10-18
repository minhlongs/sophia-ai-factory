'use client';

import type { TransitionStartFunction } from 'react';
import {
  requestCommissionPayoutAction,
  verifyCustomDomainDnsAction,
} from '@/land/partners/partner-actions';
import type { usePartnerPortalState } from './use-partner-portal-state';

export function runVerifyDns(
  state: ReturnType<typeof usePartnerPortalState>,
  isVi: boolean,
  startTransition: TransitionStartFunction,
) {
  if (!state.wlDomain.trim()) return;
  state.setDnsVerifyMsg(null);
  startTransition(async () => {
    const res = await verifyCustomDomainDnsAction(state.wlDomain.trim());
    if (res.ok) {
      state.setDnsVerifyMsg(
        res.value.verified
          ? isVi ? 'Xác thực DNS thành công! SSL đã được cấp phát.' : 'DNS verified successfully! SSL provisioned.'
          : isVi ? 'Chưa tìm thấy bản ghi DNS TXT khớp. Vui lòng đợi 5-10 phút.' : 'DNS record not yet propagating. Please wait a few minutes.',
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
}

export function runRequestPayout(
  e: React.FormEvent,
  state: ReturnType<typeof usePartnerPortalState>,
  isVi: boolean,
  startTransition: TransitionStartFunction,
) {
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
          : `Payout request for $${amountNum.toFixed(2)} submitted successfully.`,
      );
      if (state.dashboard && state.dashboard.profile) {
        state.setDashboard({
          ...state.dashboard,
          profile: {
            ...state.dashboard.profile,
            pending_payout_cents: Math.max(
              0,
              state.dashboard.profile.pending_payout_cents - Math.round(amountNum * 100),
            ),
          },
        });
      }
    } else {
      state.setPayoutErrorMsg(res.error.message);
    }
  });
}
