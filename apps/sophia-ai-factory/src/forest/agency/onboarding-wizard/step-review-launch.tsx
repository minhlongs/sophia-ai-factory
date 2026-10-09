/**
 * Agency Onboarding Wizard Step 5: Review & Launch.
 *
 * Layer: forest/agency (Presentation & Client Component)
 *
 * @module forest/agency/onboarding-wizard/step-review-launch
 */

import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import type {
  AgencyProfileInput,
  AgencyBrandingInput,
  AgencyDomainInput,
  SeedAgentDeploymentConfig,
} from '@/seed/types';

interface StepReviewLaunchProps {
  profile: AgencyProfileInput;
  branding: AgencyBrandingInput;
  domain: AgencyDomainInput;
  seedAgents: SeedAgentDeploymentConfig[];
  isVi: boolean;
}

export function StepReviewLaunch({
  profile,
  branding,
  domain,
  seedAgents,
  isVi,
}: StepReviewLaunchProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-foreground">
          {isVi ? '5. Xác Nhận & Kích Hoạt Không Gian' : '5. Review & Launch'}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {isVi
            ? 'Kiểm tra lại toàn bộ thông tin trước khi kích hoạt không gian làm việc và triển khai trợ lý AI.'
            : 'Review all configuration parameters before provisioning client workspace and deploying agents.'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-muted/30 rounded-xl border border-border space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {isVi ? 'Hồ Sơ Doanh Nghiệp' : 'Enterprise Profile'}
          </span>
          <div className="text-sm space-y-1">
            <p>
              <span className="text-muted-foreground">{isVi ? 'Tên:' : 'Name:'}</span>{' '}
              <span className="font-semibold text-foreground">{profile.clientName}</span>
            </p>
            <p>
              <span className="text-muted-foreground">{isVi ? 'Đường dẫn:' : 'Slug:'}</span>{' '}
              <span className="font-mono text-foreground">{profile.agencySlug}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Email:</span>{' '}
              <span className="text-foreground">{profile.contactEmail}</span>
            </p>
            <p>
              <span className="text-muted-foreground">
                {isVi ? 'Hạn mức điểm:' : 'Quota:'}
              </span>{' '}
              <span className="font-bold text-primary">{profile.initialMcuBudget} MCU</span>
            </p>
          </div>
        </div>

        <div className="p-4 bg-muted/30 rounded-xl border border-border space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {isVi ? 'Nhận Diện & Tên Miền' : 'Branding & Domain'}
          </span>
          <div className="text-sm space-y-1">
            <p className="flex items-center gap-2">
              <span className="text-muted-foreground">{isVi ? 'Màu chủ đạo:' : 'Primary:'}</span>
              <span
                className="w-3.5 h-3.5 rounded-full inline-block border border-border"
                style={{ backgroundColor: branding.primaryColor || '#0f172a' }}
              />
              <span className="font-mono text-xs">{branding.primaryColor}</span>
            </p>
            <p className="flex items-center gap-2">
              <span className="text-muted-foreground">{isVi ? 'Màu nhấn:' : 'Accent:'}</span>
              <span
                className="w-3.5 h-3.5 rounded-full inline-block border border-border"
                style={{ backgroundColor: branding.accentColor || '#10b981' }}
              />
              <span className="font-mono text-xs">{branding.accentColor}</span>
            </p>
            <p>
              <span className="text-muted-foreground">{isVi ? 'Tên miền:' : 'Domain:'}</span>{' '}
              <span className="font-mono text-foreground">
                {domain.customDomain || `portal/${profile.agencySlug}`}
              </span>
            </p>
          </div>
        </div>

        <div className="p-4 bg-muted/30 rounded-xl border border-border space-y-2 md:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {isVi ? 'Trợ Lý AI Sẽ Triển Khai' : 'Seed Agents Deployed'}
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            {seedAgents
              .filter((a) => a.enabled)
              .map((a) => (
                <div
                  key={a.agentId}
                  className="p-2.5 rounded-lg bg-card border border-border text-xs space-y-1"
                >
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    {a.name}
                  </div>
                  <div className="text-muted-foreground">
                    {isVi ? 'Cấp:' : 'Autonomy:'} {a.maxAutonomy} | {a.maxComputeUnitsMcu} MCU
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
