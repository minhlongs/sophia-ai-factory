/**
 * 100% White-Label Multi-Tenant Client Portal
 *
 * Route: /[locale]/portal/[agencySlug]
 * Layer: land (App Router Page)
 *
 * Guarantees:
 * 1. Zero Vendor Leakage: 0 mentions of Sophia AI Factory or platform branding.
 * 2. Dynamic Theme Variables: Injects :root CSS variables (--brand-primary, --brand-logo-url, etc.).
 * 3. Strict CSS Sanitization: Brand custom CSS is sanitized against breakouts and XSS vectors.
 * 4. Bilingual Support: Full Vietnamese and English localization.
 */

import { Metadata } from 'next';
import { getD1 } from '@/seed/db/client';
import {
  resolveAgencyBySlug,
  resolveWhitelabelTheme,
  generateThemeCssBlock,
  renderUnbrandedPortalMetadata,
} from '@/tree/partners/whitelabel-portal';
import { PortalClient } from './portal-client';

interface PageProps {
  params: Promise<{ locale: string; agencySlug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolved = await params;
  const db = await getD1();

  const agency = db ? await resolveAgencyBySlug(db, resolved.agencySlug) : null;
  const metadata = renderUnbrandedPortalMetadata(agency, resolved.locale);

  return {
    title: metadata.title,
    description: metadata.description,
    icons: metadata.icons,
    openGraph: metadata.openGraph,
    robots: metadata.robots,
    alternates: metadata.alternates,
  };
}

export default async function AgencyPortalPage({ params }: PageProps) {
  const resolved = await params;
  const locale = resolved.locale === 'vi' ? 'vi' : 'en';
  const isVi = locale === 'vi';
  const agencySlug = resolved.agencySlug;

  const db = await getD1();
  const agency = db ? await resolveAgencyBySlug(db, agencySlug) : null;

  // Unbranded 404 screen if agency does not exist
  if (!agency) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-2xl font-bold text-slate-400">
            404
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            {isVi ? 'Không Tìm Thấy Cổng Khách Hàng' : 'Client Portal Not Found'}
          </h1>
          <p className="text-sm text-slate-400">
            {isVi
              ? `Tên định danh '${agencySlug}' chưa được đăng ký hoặc đang trong quá trình kích hoạt cấu hình tên miền.`
              : `The portal for '${agencySlug}' could not be located or is pending custom domain configuration.`}
          </p>
        </div>
      </div>
    );
  }

  // Generate dynamic CSS theme tokens and sanitized custom CSS
  const themeVars = resolveWhitelabelTheme(agency);
  const themeCss = generateThemeCssBlock(themeVars, agency.customCss);

  return (
    <>
      {/* Dynamic White-Label Theme Injection */}
      <style dangerouslySetInnerHTML={{ __html: themeCss }} />

      {/* Dynamic Favicon */}
      {agency.faviconUrl && (
        <link rel="icon" href={agency.faviconUrl} />
      )}

      {/* 100% Unbranded Client Portal Interface */}
      <PortalClient
        agency={agency}
        locale={locale}
        isVi={isVi}
      />
    </>
  );
}
