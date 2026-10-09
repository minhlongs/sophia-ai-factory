'use client';

import React, { useState } from 'react';
import {
  type PortalTab,
  type PartnerPortalClientProps,
  usePartnerPortalState,
  usePartnerPortalActions,
  PublicLandingView,
  PartnerRegisterForm,
  PortalHeader,
  TabOverview,
  TabWhitelabel,
  TabPayouts,
  TabCommissions,
} from './portal';

export function PartnerPortalClient({
  initialDashboard,
  locale,
  isVi,
  isAuthenticated,
}: PartnerPortalClientProps) {
  const [activeTab, setActiveTab] = useState<PortalTab>('overview');
  const state = usePartnerPortalState(initialDashboard);
  const actions = usePartnerPortalActions(state, isVi);

  const profile = state.dashboard?.profile;
  const wlConfig = state.dashboard?.whitelabelConfig;
  const isPlatinum = profile?.tier === 'PLATINUM' || profile?.whitelabel_enabled === 1;

  const copyReferralUrl = () => {
    if (!profile) return;
    navigator.clipboard.writeText(`https://sophia.agencyos.network/?ref=${profile.referral_code}`);
    state.setCopied(true);
    setTimeout(() => state.setCopied(false), 2500);
  };

  if (!isAuthenticated && !profile) {
    return <PublicLandingView locale={locale} isVi={isVi} />;
  }

  if (isAuthenticated && !profile) {
    return (
      <PartnerRegisterForm
        isVi={isVi}
        registerName={state.registerName}
        setRegisterName={state.setRegisterName}
        registerType={state.registerType}
        setRegisterType={state.setRegisterType}
        registerCode={state.registerCode}
        setRegisterCode={state.setRegisterCode}
        registerError={state.registerError}
        isPending={actions.isPending}
        onSubmit={actions.handleRegister}
      />
    );
  }

  if (!profile || !state.dashboard) return null;

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-8 space-y-8">
      <PortalHeader
        profile={profile}
        isVi={isVi}
        copied={state.copied}
        copyReferralUrl={copyReferralUrl}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isPlatinum={isPlatinum}
      />

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
    </div>
  );
}
