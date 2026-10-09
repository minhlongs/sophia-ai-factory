'use client';

/**
 * White-Label Client Portal Unbranded Footer
 *
 * Layer: land (Client Component)
 *
 * @module app/[locale]/portal/[agencySlug]/components/portal-footer
 */

import React from 'react';
import {
  sanitizeFooterHtml,
  type UnbrandedAgencyPortalConfig,
} from '@/tree/partners/whitelabel-portal';

export interface PortalFooterProps {
  agency: UnbrandedAgencyPortalConfig;
  isVi: boolean;
}

export function PortalFooter({ agency, isVi }: PortalFooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-800/80 bg-slate-950 py-6 px-4 sm:px-8 mt-12">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
        <div>
          {agency.footerHtml ? (
            <div dangerouslySetInnerHTML={{ __html: sanitizeFooterHtml(agency.footerHtml) }} />
          ) : (
            <span>
              © {currentYear} {agency.brandName}. {isVi ? 'Bảo lưu mọi quyền.' : 'All rights reserved.'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-slate-400">
            {isVi ? 'Cổng Khách Hàng Bảo Mật' : 'Secure Client Portal'}
          </span>
          {agency.customDomain && (
            <>
              <span>•</span>
              <span className="text-slate-400">{agency.customDomain}</span>
            </>
          )}
        </div>
      </div>
    </footer>
  );
}
