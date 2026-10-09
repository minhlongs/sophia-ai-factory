/**
 * Unbranded Portal Metadata Renderer (Zero Vendor Leakage).
 *
 * Layer: tree/partners/whitelabel
 *
 * @module tree/partners/whitelabel/metadata-renderer
 */

import type { UnbrandedAgencyPortalConfig, UnbrandedPortalMetadata } from './types';
import { sanitizeUrlForCss } from './color-validator';

/**
 * Produces Next.js-compatible unbranded portal metadata without ANY vendor mentions.
 * Guarantees 0 strings of "Sophia AI Factory", "Sophia", or parent platform.
 */
export function renderUnbrandedPortalMetadata(
  config: Partial<UnbrandedAgencyPortalConfig> | null | undefined,
  locale = 'en',
): UnbrandedPortalMetadata {
  const isVi = locale === 'vi';
  const brandName =
    config?.brandName?.trim() ||
    config?.agencyName?.trim() ||
    (isVi ? 'Cổng Khách Hàng' : 'Client Portal');
  const portalTitle = config?.portalTitle?.trim();
  const logoUrl = config?.logoUrl ? sanitizeUrlForCss(config.logoUrl) : null;
  const faviconUrl = config?.faviconUrl ? sanitizeUrlForCss(config.faviconUrl) : '/favicon.ico';

  const title = portalTitle
    ? portalTitle
    : isVi
    ? `${brandName} — Cổng Khách Hàng`
    : `${brandName} — Client Portal`;

  const description = isVi
    ? `Cổng làm việc, theo dõi tiến độ và quản lý sản xuất video AI dành riêng cho khách hàng của ${brandName}.`
    : `Dedicated client portal for AI video production, campaign deliverables, and team collaboration by ${brandName}.`;

  return {
    title,
    description,
    icons: {
      icon: faviconUrl || '/favicon.ico',
      shortcut: faviconUrl || '/favicon.ico',
      ...(logoUrl ? { apple: logoUrl } : {}),
    },
    openGraph: {
      title,
      description,
      siteName: brandName,
      images: logoUrl ? [{ url: logoUrl }] : [],
      type: 'website',
    },
    robots: {
      index: false,
      follow: false,
    },
    alternates: {
      canonical: config?.agencySlug
        ? `/${locale}/portal/${config.agencySlug}`
        : `/${locale}/portal`,
      languages: {
        en: config?.agencySlug ? `/en/portal/${config.agencySlug}` : '/en/portal',
        vi: config?.agencySlug ? `/vi/portal/${config.agencySlug}` : '/vi/portal',
      },
    },
  };
}
