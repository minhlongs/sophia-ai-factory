/**
 * Agency Onboarding Wizard Step 2: Branding.
 *
 * Layer: forest/agency (Presentation & Client Component)
 *
 * @module forest/agency/onboarding-wizard/step-branding
 */

import React from 'react';
import { Sparkles } from 'lucide-react';
import type { AgencyBrandingInput, AgencyProfileInput } from '@/seed/types';
import { StepBrandingFormControls } from './step-branding-controls';

interface StepBrandingProps {
  branding: AgencyBrandingInput;
  setBranding: React.Dispatch<React.SetStateAction<AgencyBrandingInput>>;
  profile: AgencyProfileInput;
  isVi: boolean;
}

export function StepBranding({
  branding,
  setBranding,
  profile,
  isVi,
}: StepBrandingProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-foreground">
          {isVi ? '2. Nhận Diện Thương Hiệu' : '2. White-Label Branding'}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {isVi
            ? 'Tùy biến màu sắc, biểu tượng để mang lại trải nghiệm thương hiệu trọn vẹn cho khách hàng.'
            : 'Customize colors and logo to deliver an unbranded portal tailored for your client.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StepBrandingFormControls branding={branding} setBranding={setBranding} isVi={isVi} />

        {/* Live Preview Box */}
        <div className="p-5 rounded-xl border border-border bg-muted/30 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                {isVi ? 'Xem Trước Giao Diện Cổng Khách Hàng' : 'Live Unbranded Preview'}
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-medium">
                {isVi ? 'Thương Hiệu Riêng' : '100% Unbranded'}
              </span>
            </div>

            <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden text-left">
              <div
                className="px-4 py-3 flex items-center justify-between border-b"
                style={{ backgroundColor: branding.primaryColor || '#0f172a', color: '#ffffff' }}
              >
                <div className="flex items-center gap-2">
                  {branding.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={branding.logoUrl}
                      alt="Logo"
                      className="h-6 w-auto object-contain max-w-[100px]"
                      onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-6 h-6 rounded bg-white/20 flex items-center justify-center text-xs font-bold">
                      {(profile.clientName || 'C')[0]?.toUpperCase()}
                    </div>
                  )}
                  <span className="font-semibold text-xs tracking-tight">
                    {profile.clientName || (isVi ? 'Tên Khách Hàng' : 'Client Name')}
                  </span>
                </div>
                <div
                  className="px-2 py-0.5 rounded text-[10px] font-medium"
                  style={{ backgroundColor: branding.accentColor || '#10b981', color: '#ffffff' }}
                >
                  {isVi ? 'Cổng Khách' : 'Portal'}
                </div>
              </div>

              <div className="p-4 space-y-3">
                <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
                <div className="h-16 bg-muted/60 rounded-md border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground">
                  {isVi ? 'Khu vực duyệt video và tài liệu' : 'Video Deliverable Review Space'}
                </div>
                <div className="flex justify-end gap-2">
                  <div
                    className="px-3 py-1 rounded text-xs font-medium text-white shadow-sm"
                    style={{ backgroundColor: branding.accentColor || '#10b981' }}
                  >
                    {isVi ? 'Phê Duyệt Video' : 'Approve Draft'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground mt-4 text-center">
            {isVi
              ? 'Giao diện không hiển thị tên Sophia AI Factory khi khách hàng truy cập.'
              : 'Zero references to Sophia AI Factory shown to your clients.'}
          </p>
        </div>
      </div>
    </div>
  );
}
