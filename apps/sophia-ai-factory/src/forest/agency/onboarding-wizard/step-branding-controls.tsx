/**
 * Form input controls for Agency Onboarding Wizard Step 2: Branding.
 * @module forest/agency/onboarding-wizard/step-branding-controls
 */

import React from 'react';
import type { AgencyBrandingInput } from '@/seed/types';

export function StepBrandingFormControls({
  branding,
  setBranding,
  isVi,
}: {
  branding: AgencyBrandingInput;
  setBranding: React.Dispatch<React.SetStateAction<AgencyBrandingInput>>;
  isVi: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          {isVi ? 'Đường Dẫn Logo (URL)' : 'Logo Image URL'}
        </label>
        <input
          type="url"
          placeholder="https://example.com/logo.png"
          value={branding.logoUrl || ''}
          onChange={(e) => setBranding((prev) => ({ ...prev, logoUrl: e.target.value }))}
          className="w-full px-3.5 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            {isVi ? 'Màu Chủ Đạo' : 'Primary Color'}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={branding.primaryColor || '#0f172a'}
              onChange={(e) => setBranding((prev) => ({ ...prev, primaryColor: e.target.value }))}
              className="w-9 h-9 p-0.5 rounded border border-border cursor-pointer bg-background"
            />
            <input
              type="text"
              value={branding.primaryColor || '#0f172a'}
              onChange={(e) => setBranding((prev) => ({ ...prev, primaryColor: e.target.value }))}
              className="w-full px-2.5 py-1.5 font-mono text-xs bg-background border border-input rounded text-foreground"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            {isVi ? 'Màu Điểm Nhấn' : 'Accent Color'}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={branding.accentColor || '#10b981'}
              onChange={(e) => setBranding((prev) => ({ ...prev, accentColor: e.target.value }))}
              className="w-9 h-9 p-0.5 rounded border border-border cursor-pointer bg-background"
            />
            <input
              type="text"
              value={branding.accentColor || '#10b981'}
              onChange={(e) => setBranding((prev) => ({ ...prev, accentColor: e.target.value }))}
              className="w-full px-2.5 py-1.5 font-mono text-xs bg-background border border-input rounded text-foreground"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          {isVi ? 'Tùy Biến CSS Bổ Sung' : 'Custom CSS (Optional)'}
        </label>
        <textarea
          rows={3}
          placeholder=".client-portal { border-radius: 8px; }"
          value={branding.customCss || ''}
          onChange={(e) => setBranding((prev) => ({ ...prev, customCss: e.target.value }))}
          className="w-full px-3.5 py-2 font-mono text-xs bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <p className="text-xs text-muted-foreground">
          {isVi
            ? 'Bộ lọc tự động loại bỏ các đoạn mã độc hại để đảm bảo an toàn.'
            : 'Security sanitizer automatically strips script tags and malicious attributes.'}
        </p>
      </div>
    </div>
  );
}
