/**
 * Agency Onboarding Wizard Success View.
 *
 * Layer: forest/agency (Presentation & Client Component)
 *
 * @module forest/agency/onboarding-wizard/wizard-success-view
 */

import React from 'react';
import Link from 'next/link';
import { CheckCircle2, ExternalLink, Rocket } from 'lucide-react';
import type { AgencyOnboardingResult, AgencyProfileInput, SeedAgentDeploymentConfig } from '@/seed/types';

interface WizardSuccessViewProps {
  launchResult: AgencyOnboardingResult;
  profile: AgencyProfileInput;
  seedAgents: SeedAgentDeploymentConfig[];
  isVi: boolean;
  locale: string;
}

export function WizardSuccessView({
  launchResult,
  profile,
  seedAgents,
  isVi,
  locale,
}: WizardSuccessViewProps) {
  const portalPath = launchResult.portalUrl || `/portal/${launchResult.agencySlug || profile.agencySlug}`;
  const deployedCount = launchResult.deployedAgentsCount || seedAgents.filter((a) => a.enabled).length;

  return (
    <div className="max-w-3xl mx-auto p-8 bg-card rounded-2xl border border-border shadow-xl text-center space-y-6">
      <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
        <CheckCircle2 className="w-10 h-10" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight text-foreground">
        {isVi ? 'Không Gian Khách Hàng Đã Sẵn Sàng!' : 'Client Workspace Live!'}
      </h2>
      <p className="text-muted-foreground max-w-lg mx-auto">
        {isVi
          ? `Tài khoản cho ${profile.clientName} cùng với ${deployedCount} trợ lý AI tự động đã được kích hoạt thành công.`
          : `Client workspace for ${profile.clientName} and ${deployedCount} autonomous seed agents are now fully active.`}
      </p>

      <div className="p-4 bg-muted/50 rounded-xl border border-border text-left max-w-md mx-auto space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {isVi ? 'Đường Dẫn Cổng Thông Tin' : 'Client Portal Link'}
        </div>
        <div className="flex items-center justify-between text-sm font-mono text-foreground break-all">
          <span>{portalPath}</span>
          <Link
            href={portalPath}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline font-sans text-xs ml-2 shrink-0"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {isVi ? 'Mở Cổng' : 'Open'}
          </Link>
        </div>
      </div>

      <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
        <Link
          href={`/${locale}/agency`}
          className="w-full sm:w-auto px-6 py-2.5 rounded-lg border border-border bg-background text-foreground hover:bg-muted text-sm font-medium transition-colors"
        >
          {isVi ? 'Quay Lại Bảng Quản Trị' : 'Return to Agency Cockpit'}
        </Link>
        <Link
          href={portalPath}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors inline-flex items-center justify-center gap-2"
        >
          <Rocket className="w-4 h-4" />
          {isVi ? 'Truy Cập Cổng Khách Hàng' : 'Open Client Portal'}
        </Link>
      </div>
    </div>
  );
}
