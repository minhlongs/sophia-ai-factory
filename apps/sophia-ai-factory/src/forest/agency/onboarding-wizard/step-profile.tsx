/**
 * Agency Onboarding Wizard Step 1: Profile.
 *
 * Layer: forest/agency (Presentation & Client Component)
 *
 * @module forest/agency/onboarding-wizard/step-profile
 */

import React from 'react';
import type { AgencyProfileInput } from '@/seed/types';

interface StepProfileProps {
  profile: AgencyProfileInput;
  setProfile: React.Dispatch<React.SetStateAction<AgencyProfileInput>>;
  onClientNameChange: (name: string) => void;
  isVi: boolean;
}

export function StepProfile({
  profile,
  setProfile,
  onClientNameChange,
  isVi,
}: StepProfileProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-foreground">
          {isVi ? '1. Hồ Sơ Khách Hàng' : '1. Client Profile'}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {isVi
            ? 'Khai báo thông tin cơ bản của doanh nghiệp khách hàng để thiết lập không gian riêng biệt.'
            : 'Specify basic enterprise information to configure the isolated workspace.'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2 sm:col-span-2">
          <label className="text-sm font-medium text-foreground">
            {isVi ? 'Tên Doanh Nghiệp Khách Hàng *' : 'Client Business Name *'}
          </label>
          <input
            type="text"
            required
            placeholder={isVi ? 'Ví dụ: Tập Đoàn Truyền Thông Á Châu' : 'e.g. Acme Media Group'}
            value={profile.clientName}
            onChange={(e) => onClientNameChange(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            {isVi ? 'Đường Dẫn Không Gian (Slug) *' : 'Workspace Slug *'}
          </label>
          <input
            type="text"
            required
            placeholder="acme-media"
            value={profile.agencySlug}
            onChange={(e) =>
              setProfile((prev) => ({
                ...prev,
                agencySlug: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''),
              }))
            }
            className="w-full px-3.5 py-2.5 bg-background border border-input rounded-lg text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="text-xs text-muted-foreground">
            {isVi
              ? 'Đường dẫn cổng thông tin: agencyos.network/portal/[slug]'
              : 'Portal address: agencyos.network/portal/[slug]'}
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            {isVi ? 'Email Liên Hệ Chính *' : 'Primary Contact Email *'}
          </label>
          <input
            type="email"
            required
            placeholder="contact@client.com"
            value={profile.contactEmail}
            onChange={(e) => setProfile((prev) => ({ ...prev, contactEmail: e.target.value }))}
            className="w-full px-3.5 py-2.5 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            {isVi ? 'Lĩnh Vực Hoạt Động' : 'Industry Category'}
          </label>
          <select
            value={profile.industryTag}
            onChange={(e) => setProfile((prev) => ({ ...prev, industryTag: e.target.value }))}
            className="w-full px-3.5 py-2.5 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="ecommerce">{isVi ? 'Thương Mại Điện Tử' : 'E-Commerce'}</option>
            <option value="marketing_agency">{isVi ? 'Đại Lý Tiếp Thị / Agency' : 'Marketing Agency'}</option>
            <option value="content_creator">{isVi ? 'Nhà Sáng Tạo Nội Dung' : 'Content Creator'}</option>
            <option value="saas">{isVi ? 'Công Nghệ Phần Mềm (SaaS)' : 'SaaS / Tech'}</option>
            <option value="retail">{isVi ? 'Bán Lẻ & Dịch Vụ' : 'Retail & Services'}</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            {isVi ? 'Hạn Mức Điểm Sản Xuất (MCU) *' : 'Initial Credit Quota (MCU) *'}
          </label>
          <input
            type="number"
            min="50"
            step="50"
            value={profile.initialMcuBudget}
            onChange={(e) =>
              setProfile((prev) => ({
                ...prev,
                initialMcuBudget: parseInt(e.target.value, 10) || 0,
              }))
            }
            className="w-full px-3.5 py-2.5 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="text-xs text-muted-foreground">
            {isVi
              ? 'Hạn mức điểm dùng cho kết xuất video và các tác vụ trợ lý tự động.'
              : 'Compute points allocated for rendering videos and autonomous agent tasks.'}
          </p>
        </div>
      </div>
    </div>
  );
}
