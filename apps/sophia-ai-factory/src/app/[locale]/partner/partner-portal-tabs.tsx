'use client';

/**
 * Tab content renderer for PartnerPortalClient.
 * Layer: app/[locale]/partner
 * @module app/[locale]/partner/partner-portal-tabs
 */

import React from 'react';
import {
  type PortalTab,
  TabOverview,
  TabWhitelabel,
  TabPayouts,
  TabCommissions,
} from './portal';
import type { PartnerProfile, PartnerDashboardData } from '@/tree/partners/types';
import type { usePartnerPortalState } from './portal/use-partner-portal-state';
import type { usePartnerPortalActions } from './portal/use-partner-portal-actions';

interface Props {
  activeTab: PortalTab;
  profile: PartnerProfile;
  state: Omit<ReturnType<typeof usePartnerPortalState>, 'dashboard'> & { dashboard: PartnerDashboardData };
  actions: ReturnType<typeof usePartnerPortalActions>;
  locale: string;
  isVi: boolean;
  isPlatinum: boolean;
}

export function PartnerPortalTabContent({
  activeTab,
  profile,
  state,
  actions,
  locale,
  isVi,
  isPlatinum,
}: Props) {
  const wlConfig = state.dashboard?.whitelabelConfig;

  return (
    <div className="pt-2">
      {activeTab === 'overview' && (
        <TabOverview profile={profile} nextTier={state.dashboard.nextTier} isVi={isVi} />
      )}

      {activeTab === 'whitelabel' && (
        <TabWhitelabel
          isPlatinum={isPlatinum}
          isVi={isVi}
          wlConfig={wlConfig ?? null}
          wlBrandName={state.wlBrandName}
          setWlBrandName={state.setWlBrandName}
          wlDomain={state.wlDomain}
          setWlDomain={state.setWlDomain}
          wlPrimaryColor={state.wlPrimaryColor}
          setWlPrimaryColor={state.setWlPrimaryColor}
          wlAccentColor={state.wlAccentColor}
          setWlAccentColor={state.setWlAccentColor}
          wlLogoUrl={state.wlLogoUrl}
          setWlLogoUrl={state.setWlLogoUrl}
          wlSupportUrl={state.wlSupportUrl}
          setWlSupportUrl={state.setWlSupportUrl}
          wlSuccessMsg={state.wlSuccessMsg}
          wlErrorMsg={state.wlErrorMsg}
          dnsVerifyMsg={state.dnsVerifyMsg}
          isPending={actions.isPending}
          onSaveWhitelabel={actions.handleSaveWhitelabel}
          onVerifyDns={actions.handleVerifyDns}
        />
      )}

      {activeTab === 'payouts' && (
        <TabPayouts
          profile={profile}
          isVi={isVi}
          payoutAmount={state.payoutAmount}
          setPayoutAmount={state.setPayoutAmount}
          payoutRail={state.payoutRail}
          setPayoutRail={state.setPayoutRail}
          payoutDest={state.payoutDest}
          setPayoutDest={state.setPayoutDest}
          payoutSuccessMsg={state.payoutSuccessMsg}
          payoutErrorMsg={state.payoutErrorMsg}
          isPending={actions.isPending}
          onRequestPayout={actions.handleRequestPayout}
        />
      )}

      {activeTab === 'commissions' && (
        <TabCommissions
          recentCommissions={state.dashboard.recentCommissions}
          locale={locale}
          isVi={isVi}
        />
      )}
    </div>
  );
}
