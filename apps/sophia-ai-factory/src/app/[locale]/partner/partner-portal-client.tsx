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
} from './portal';
import { PartnerPortalTabContent } from './partner-portal-tabs';

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

      <PartnerPortalTabContent
        activeTab={activeTab}
        profile={profile}
        state={{ ...state, dashboard: state.dashboard }}
        actions={actions}
        locale={locale}
        isVi={isVi}
        isPlatinum={isPlatinum}
      />
    </div>
  );
}
