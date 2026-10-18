'use client';

/**
 * White-Label Client Portal Support Tab
 *
 * Layer: land (Client Component)
 *
 * @module app/[locale]/portal/[agencySlug]/components/portal-support-tab
 */

import React from 'react';
import type { UnbrandedAgencyPortalConfig } from '@/tree/partners/whitelabel-portal';

export interface PortalSupportTabProps {
  agency: UnbrandedAgencyPortalConfig;
  isVi: boolean;
}

export function PortalSupportTab({ agency, isVi }: PortalSupportTabProps) {
  return (
    <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
      <h2 className="text-xl font-bold text-white">
        {isVi ? 'Trung Tâm Hỗ Trợ Khách Hàng' : 'Client Support & Account Executive'}
      </h2>
      <p className="text-sm text-slate-400">
        {isVi
          ? `Đội ngũ hỗ trợ chuyên biệt của ${agency.brandName} luôn sẵn sàng đồng hành cùng bạn 24/7.`
          : `Dedicated account executive and support team by ${agency.brandName} available 24/7.`}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
            {isVi ? 'Email Hỗ trợ Trực tiếp' : 'Direct Support Email'}
          </div>
          <div className="text-base font-bold text-white">
            {agency.customEmailSender ||
              (agency.customDomain ? `support@${agency.customDomain}` : 'support@agencybrand.com')}
          </div>
          <p className="text-xs text-slate-400">
            {isVi
              ? 'Thời gian phản hồi cam kết trong vòng 30 phút đối với khách hàng doanh nghiệp.'
              : 'Guaranteed 30-minute response time for enterprise tier accounts.'}
          </p>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
            {isVi ? 'Cổng Hỗ trợ & Tài liệu' : 'Help Center & Documentation'}
          </div>
          <div className="text-base font-bold text-white">
            {agency.supportUrl ? (
              <a
                href={agency.supportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-cyan-300"
              >
                {agency.supportUrl}
              </a>
            ) : agency.customDomain ? (
              `https://${agency.customDomain}/support`
            ) : (
              'Help Desk'
            )}
          </div>
          <p className="text-xs text-slate-400">
            {isVi
              ? 'Truy cập tài liệu hướng dẫn và kho mẫu video chiến dịch.'
              : 'Access knowledge base, video template blueprints, and API guides.'}
          </p>
        </div>
      </div>
    </section>
  );
}
