/**
 * Agency Onboarding Wizard Step 3: Domain.
 *
 * Layer: forest/agency (Presentation & Client Component)
 *
 * @module forest/agency/onboarding-wizard/step-domain
 */

import React from 'react';
import { Globe, Shield, CheckCircle2 } from 'lucide-react';
import type { AgencyDomainInput } from '@/seed/types';

interface StepDomainProps {
  domain: AgencyDomainInput;
  setDomain: React.Dispatch<React.SetStateAction<AgencyDomainInput>>;
  isVi: boolean;
}

export function StepDomain({ domain, setDomain, isVi }: StepDomainProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-foreground">
          {isVi ? '3. Tên Miền Riêng' : '3. Custom Domain & DNS'}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {isVi
            ? 'Gắn tên miền riêng để cổng thông tin hoạt động trực tiếp dưới địa chỉ của doanh nghiệp.'
            : 'Map a sovereign hostname so client portals operate under your enterprise domain.'}
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            {isVi ? 'Tên Miền Tùy Chỉnh (FQDN)' : 'Custom Domain (FQDN)'}
          </label>
          <div className="relative">
            <Globe className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="portal.clientbrand.com"
              value={domain.customDomain || ''}
              onChange={(e) =>
                setDomain((prev) => ({
                  ...prev,
                  customDomain: e.target.value.toLowerCase().trim(),
                }))
              }
              className="w-full pl-10 pr-3.5 py-2.5 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {isVi
              ? 'Bạn có thể để trống nếu chỉ muốn dùng đường dẫn mặc định: agencyos.network/portal/[slug]'
              : 'Optional. Leave blank to use the default URL: agencyos.network/portal/[slug]'}
          </p>
        </div>

        {/* DNS Instruction Card */}
        <div className="p-4 bg-muted/40 rounded-xl border border-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-primary" />
              {isVi ? 'Hướng Dẫn Cấu Hình DNS CNAME' : 'DNS CNAME Configuration'}
            </div>
            <div className="flex items-center gap-1 text-emerald-600 text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {isVi ? 'SSL Tự Động Sẵn Sàng' : 'Automated Edge SSL'}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono bg-card p-3 rounded-lg border border-border">
            <div>
              <span className="text-muted-foreground block text-[10px] font-sans">
                {isVi ? 'Loại Bản Ghi' : 'Record Type'}
              </span>
              <span className="font-bold text-foreground">CNAME</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px] font-sans">
                {isVi ? 'Tên Máy Chủ' : 'Host / Name'}
              </span>
              <span className="text-foreground">
                {domain.customDomain ? domain.customDomain.split('.')[0] : 'portal'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px] font-sans">
                {isVi ? 'Giá Trị Trỏ Về' : 'Target / Value'}
              </span>
              <span className="text-primary font-bold">agencyos.network</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
