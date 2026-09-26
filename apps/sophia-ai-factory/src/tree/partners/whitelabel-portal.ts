/**
 * Advanced White-Label & Custom Domain Federation Engine
 *
 * Layer: tree (pure domain logic & D1 database operations)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * Responsibilities:
 * 1. resolveWhitelabelTheme: Generates dynamic CSS variables (--brand-primary, --brand-secondary, --brand-logo-url, etc.)
 * 2. sanitizeBrandCss: Rigorously strips <script>, @import, url(javascript:...), expressions, and CSS breakout vectors
 * 3. resolveAgencyByDomain: Queries D1 partner_organizations or partner_whitelabel_configs by custom domain / CNAME
 * 4. resolveAgencyBySlug: Queries D1 by agency slug
 * 5. renderUnbrandedPortalMetadata: Produces Next.js-compatible metadata with zero vendor leakage
 *
 * @module tree/partners/whitelabel-portal
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { PartnerWhitelabelConfig } from '@/tree/partners/types';

/**
 * Resolved Unbranded Agency Configuration for White-Label Client Portals
 */
export interface UnbrandedAgencyPortalConfig {
  partnerId: string;
  agencySlug: string;
  agencyName: string;
  brandName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  customDomain: string | null;
  customEmailSender: string | null;
  supportUrl: string | null;
  footerHtml: string | null;
  portalTitle: string;
  loginHeadline: string | null;
  loginSubheading: string | null;
  customCss: string | null;
  isSslActive: boolean;
}

export interface WhitelabelThemeInput {
  primaryColor?: string;
  accentColor?: string;
  secondaryColor?: string;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  brandName?: string;
  agencyName?: string;
  supportEmail?: string | null;
  customCss?: string | null;
  fontFamily?: string;
  portalTitle?: string;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  logo_url?: string | null;
  favicon_url?: string | null;
  brand_name?: string;
  support_email?: string | null;
  custom_css?: string | null;
}

/**
 * Metadata configuration for 100% unbranded portal views
 */
export interface UnbrandedPortalMetadata {
  title: string;
  description: string;
  icons: {
    icon: string;
    shortcut?: string;
    apple?: string;
  };
  openGraph: {
    title: string;
    description: string;
    siteName: string;
    images: Array<{ url: string }>;
    type: string;
  };
  robots: {
    index: boolean;
    follow: boolean;
  };
  alternates?: {
    canonical?: string;
    languages?: Record<string, string>;
  };
}

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Validates a hex color string (#RRGGBB). Falls back to a safe color if invalid.
 */
export function validateHexColor(color: string | null | undefined, fallback: string): string {
  if (!color || typeof color !== 'string') {
    return fallback;
  }
  const trimmed = color.trim();
  return HEX_COLOR_REGEX.test(trimmed) ? trimmed : fallback;
}

/**
 * Sanitizes a URL for safe embedding inside CSS url("...").
 * Prevents CSS injection, url() breakouts, quotes, parens, and javascript: protocols.
 */
export function sanitizeUrlForCss(rawUrl: string | null | undefined): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return '';
  }
  const trimmed = rawUrl.trim();

  // Reject any string containing quotes, parentheses, backslashes, angle brackets, semicolons, or control whitespace
  if (/["'()\\<>;\s\r\n]/.test(trimmed)) {
    return '';
  }

  // Reject javascript:, vbscript:, data: URIs
  if (/^(javascript|vbscript|data):/i.test(trimmed)) {
    return '';
  }

  // Must start with https://, http://, or /
  if (!/^(https?:\/\/|\/)[^"'()\\<>;\s]+$/i.test(trimmed)) {
    return '';
  }

  return trimmed;
}

export interface WhitelabelThemeInput {
  brandName?: string;
  brand_name?: string;
  agencyName?: string;
  agency_name?: string;
  agency_slug?: string;
  agencySlug?: string;
  portal_title?: string;
  portalTitle?: string;
  primaryColor?: string;
  primary_color?: string;
  secondaryColor?: string;
  secondary_color?: string;
  accentColor?: string;
  accent_color?: string;
  logoUrl?: string | null;
  logo_url?: string | null;
  faviconUrl?: string | null;
  favicon_url?: string | null;
  supportUrl?: string | null;
  support_url?: string | null;
  footerHtml?: string | null;
  footer_html?: string | null;
  customCss?: string | null;
  custom_css?: string | null;
  loginHeadline?: string | null;
  login_headline?: string | null;
  loginSubheading?: string | null;
  login_subheading?: string | null;
  isSslActive?: boolean;
  is_ssl_active?: number;
}

/**
 * Generates dynamic CSS variables for white-label theme injection.
 * Variables generated:
 * - `--brand-primary`
 * - `--brand-secondary`
 * - `--brand-accent`
 * - `--brand-logo-url`
 * - `--brand-favicon`
 * - `--brand-favicon-url`
 * - `--brand-agency-name`
 * - `--brand-support-url`
 * - `--brand-portal-title`
 * - `--primary`
 * - `--primary-foreground`
 * - `--ring`
 */
export function resolveWhitelabelTheme(
  config?:
    | WhitelabelThemeInput
    | Partial<PartnerWhitelabelConfig>
    | Partial<UnbrandedAgencyPortalConfig>
    | null,
): Record<string, string> {
  const cfg = (config ?? null) as WhitelabelThemeInput | null;

  const primaryColor = validateHexColor(
    cfg?.primaryColor ?? cfg?.primary_color,
    '#06b6d4',
  );

  const secondaryColor = validateHexColor(
    cfg?.accentColor ??
      cfg?.accent_color ??
      cfg?.secondaryColor ??
      cfg?.secondary_color,
    '#3b82f6',
  );

  const rawLogo = cfg?.logoUrl ?? cfg?.logo_url;
  const logoUrl = sanitizeUrlForCss(rawLogo);

  const rawFavicon = cfg?.faviconUrl ?? cfg?.favicon_url;
  const faviconUrl = sanitizeUrlForCss(rawFavicon);

  const brandName =
    cfg?.brandName?.trim() ??
    cfg?.brand_name?.trim() ??
    cfg?.agencyName?.trim() ??
    cfg?.agency_name?.trim() ??
    'Agency Client Portal';

  const rawSupport = cfg?.supportUrl ?? cfg?.support_url;
  const supportUrl = sanitizeUrlForCss(rawSupport);

  const portalTitle =
    cfg?.portalTitle?.trim() ??
    cfg?.portal_title?.trim() ??
    brandName;

  return {
    '--brand-primary': primaryColor,
    '--brand-secondary': secondaryColor,
    '--brand-accent': secondaryColor,
    '--brand-logo-url': logoUrl ? `url("${logoUrl}")` : 'none',
    '--brand-favicon': faviconUrl ? `url("${faviconUrl}")` : 'none',
    '--brand-favicon-url': faviconUrl,
    '--brand-agency-name': `"${brandName.replace(/"/g, '')}"`,
    '--brand-support-url': supportUrl,
    '--brand-portal-title': `"${portalTitle.replace(/"/g, '')}"`,
    '--primary': primaryColor,
    '--primary-foreground': '#ffffff',
    '--ring': primaryColor,
  };
}

/**
 * Rigorously strips <script>, @import, url(javascript:...), CSS expressions,
 * HTML breakout tags, and malicious injection vectors from custom CSS.
 */
export function sanitizeBrandCss(customCss: string | null | undefined): string {
  if (!customCss || typeof customCss !== 'string') {
    return '';
  }

  // 0. Pre-sanitization: Strip null bytes and control characters FIRST before any regex checks
  // Prevents bypass attacks like @\x00import or java\x00script:
  let sanitized = customCss.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // 1. Remove full <script>...</script> blocks including content
  sanitized = sanitized.replace(/<script[\s\S]*?(?:<\/script>|$)/gi, '');

  // 2. Remove style tags (both opening and closing) to prevent breakout
  sanitized = sanitized.replace(/<\/?style[^>]*>/gi, '');

  // 3. Remove any remaining HTML tags (<html>, <body>, <iframe>, etc.)
  sanitized = sanitized.replace(/<\/?(?:html|body|iframe|img|svg|object|embed|link|meta)[\s\S]*?>/gi, '');
  sanitized = sanitized.replace(/<!--[\s\S]*?-->/g, '');
  sanitized = sanitized.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // 4. Strip @import rules completely (remote stylesheet injection)
  sanitized = sanitized.replace(/@import\s+(?:url\([^)]*\)|["'][^"']*["'])[^;]*;?/gi, '');
  sanitized = sanitized.replace(/@import[^;{}]+;?/gi, '');

  // 5. Strip @charset, @namespace
  sanitized = sanitized.replace(/@(?:charset|namespace)[^;]+;?/gi, '');

  // 6. Strip url(javascript:...), url(data:...), url(vbscript:...)
  sanitized = sanitized.replace(/url\s*\(\s*["']?\s*(?:javascript|vbscript|livescript|mocha|data\s*:\s*text)[\s\S]*?\)/gi, 'none');

  // 7. Strip inline javascript: or vbscript: anywhere in CSS declarations
  sanitized = sanitized.replace(/(?:javascript|vbscript|livescript)\s*:/gi, '');

  // 8. Strip IE expression(...) and behavior: properties
  sanitized = sanitized.replace(/expression\s*\([^)]*\)/gi, 'none');
  sanitized = sanitized.replace(/behavior\s*:[^;}]*/gi, '');
  sanitized = sanitized.replace(/-moz-binding\s*:[^;}]*/gi, '');

  // 9. Final defense-in-depth: Strip null bytes and control characters
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  return sanitized.trim();
}

/**
 * Generates an unbranded `:root { ... }` CSS block from theme variables and custom CSS.
 */
export function generateThemeCssBlock(
  variables: Record<string, string>,
  customCss?: string | null,
): string {
  const varLines = Object.entries(variables)
    .map(([key, val]) => `  ${key}: ${val};`)
    .join('\n');

  const sanitizedCss = sanitizeBrandCss(customCss);

  return `:root {\n${varLines}\n}${sanitizedCss ? `\n\n/* Agency Custom Styles */\n${sanitizedCss}` : ''}`;
}

/**
 * Resolves an agency's white-label configuration by custom domain / CNAME hostname.
 * Queries partner_whitelabel_configs or partner_organizations in D1.
 *
 * @param db D1Database binding
 * @param hostname Incoming Host header (e.g. "portal.apexmarketing.com")
 */
export async function resolveAgencyByDomain(
  db: D1Database,
  hostname: string,
): Promise<UnbrandedAgencyPortalConfig | null> {
  const cleanHost = (hostname || '').trim().toLowerCase();
  if (!cleanHost || cleanHost === 'localhost' || cleanHost === '127.0.0.1') {
    return null;
  }

  // 1. Query partner_whitelabel_configs where custom_domain matches and SSL is active
  try {
    const whitelabelRow = await db
      .prepare(
        `SELECT
          pwc.id,
          pwc.partner_id,
          pwc.brand_name,
          pwc.logo_url,
          pwc.favicon_url,
          pwc.primary_color,
          pwc.accent_color,
          pwc.custom_domain,
          pwc.custom_email_sender,
          pwc.support_url,
          pwc.footer_html,
          pwc.is_ssl_active,
          COALESCE(pwc.agency_slug, po.slug) as agency_slug,
          COALESCE(pwc.portal_title, pwc.brand_name) as portal_title,
          pwc.login_headline,
          pwc.login_subheading,
          pwc.custom_css,
          po.name as org_name,
          po.status as org_status
        FROM partner_whitelabel_configs pwc
        LEFT JOIN partner_organizations po ON po.partner_id = pwc.partner_id
        WHERE LOWER(pwc.custom_domain) = ?1 AND pwc.is_ssl_active = 1
        LIMIT 1`
      )
      .bind(cleanHost)
      .first<{
        id: string;
        partner_id: string;
        brand_name: string;
        logo_url: string | null;
        favicon_url: string | null;
        primary_color: string | null;
        accent_color: string | null;
        custom_domain: string | null;
        custom_email_sender: string | null;
        support_url: string | null;
        footer_html: string | null;
        is_ssl_active: number;
        agency_slug: string | null;
        portal_title: string | null;
        login_headline: string | null;
        login_subheading: string | null;
        custom_css: string | null;
        org_name: string | null;
        org_status: string | null;
      }>();

    if (whitelabelRow) {
      const brand = whitelabelRow.brand_name?.trim() || whitelabelRow.org_name || 'Agency Portal';
      const slug =
        whitelabelRow.agency_slug ||
        brand.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') ||
        'agency';

      return {
        partnerId: whitelabelRow.partner_id,
        agencySlug: slug,
        agencyName: whitelabelRow.org_name || brand,
        brandName: brand,
        logoUrl: whitelabelRow.logo_url,
        faviconUrl: whitelabelRow.favicon_url,
        primaryColor: validateHexColor(whitelabelRow.primary_color, '#06b6d4'),
        secondaryColor: validateHexColor(whitelabelRow.accent_color, '#3b82f6'),
        customDomain: whitelabelRow.custom_domain,
        customEmailSender: whitelabelRow.custom_email_sender,
        supportUrl: whitelabelRow.support_url,
        footerHtml: whitelabelRow.footer_html,
        portalTitle: whitelabelRow.portal_title || brand,
        loginHeadline: whitelabelRow.login_headline,
        loginSubheading: whitelabelRow.login_subheading,
        customCss: whitelabelRow.custom_css,
        isSslActive: whitelabelRow.is_ssl_active === 1,
      };
    }
  } catch {
    // If table column variations exist during migration rollout, proceed to partner_organizations fallback
  }

  // 2. Query partner_organizations by custom_domain where status is 'active'
  try {
    const orgRow = await db
      .prepare(
        `SELECT
          po.id,
          po.partner_id,
          po.name,
          po.slug,
          po.custom_domain,
          po.whitelabel_config_json,
          po.status,
          pwc.logo_url,
          pwc.favicon_url,
          pwc.primary_color,
          pwc.accent_color,
          pwc.custom_email_sender,
          pwc.support_url,
          pwc.footer_html,
          pwc.is_ssl_active
        FROM partner_organizations po
        LEFT JOIN partner_whitelabel_configs pwc ON pwc.partner_id = po.partner_id
        WHERE LOWER(po.custom_domain) = ?1 AND po.status = 'active'
        LIMIT 1`
      )
      .bind(cleanHost)
      .first<{
        id: string;
        partner_id: string;
        name: string;
        slug: string | null;
        custom_domain: string | null;
        whitelabel_config_json: string | null;
        status: string;
        logo_url: string | null;
        favicon_url: string | null;
        primary_color: string | null;
        accent_color: string | null;
        custom_email_sender: string | null;
        support_url: string | null;
        footer_html: string | null;
        is_ssl_active: number | null;
      }>();

    if (orgRow) {
      let parsedJson: Record<string, unknown> = {};
      try {
        if (orgRow.whitelabel_config_json) {
          parsedJson = JSON.parse(orgRow.whitelabel_config_json) as Record<string, unknown>;
        }
      } catch {
        parsedJson = {};
      }

      const brand =
        typeof parsedJson.brandName === 'string' && parsedJson.brandName.trim()
          ? parsedJson.brandName.trim()
          : orgRow.name;

      const slug =
        orgRow.slug ||
        brand.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') ||
        'agency';

      return {
        partnerId: orgRow.partner_id,
        agencySlug: slug,
        agencyName: orgRow.name,
        brandName: brand,
        logoUrl: (parsedJson.logoUrl as string) || orgRow.logo_url || null,
        faviconUrl: (parsedJson.faviconUrl as string) || orgRow.favicon_url || null,
        primaryColor: validateHexColor(
          (parsedJson.primaryColor as string) || orgRow.primary_color,
          '#06b6d4',
        ),
        secondaryColor: validateHexColor(
          (parsedJson.secondaryColor as string) || orgRow.accent_color,
          '#3b82f6',
        ),
        customDomain: orgRow.custom_domain,
        customEmailSender:
          (parsedJson.customEmailSender as string) || orgRow.custom_email_sender || null,
        supportUrl: (parsedJson.supportUrl as string) || orgRow.support_url || null,
        footerHtml: (parsedJson.footerHtml as string) || orgRow.footer_html || null,
        portalTitle: (parsedJson.portalTitle as string) || brand,
        loginHeadline: (parsedJson.loginHeadline as string) || null,
        loginSubheading: (parsedJson.loginSubheading as string) || null,
        customCss: (parsedJson.customCss as string) || null,
        isSslActive: orgRow.is_ssl_active === 1,
      };
    }
  } catch {
    // Return null if table does not exist or query fails
  }

  return null;
}

/**
 * Resolves an agency's white-label configuration by agency slug (/portal/[agencySlug]).
 *
 * @param db D1Database binding
 * @param slug Agency URL slug (e.g. "apex-marketing")
 */
export async function resolveAgencyBySlug(
  db: D1Database,
  slug: string,
): Promise<UnbrandedAgencyPortalConfig | null> {
  const cleanSlug = (slug || '').trim().toLowerCase();
  if (!cleanSlug) {
    return null;
  }

  // 1. Check partner_organizations joined with partner_whitelabel_configs by slug
  try {
    const orgRow = await db
      .prepare(
        `SELECT
          po.id,
          po.partner_id,
          po.name,
          po.slug,
          po.custom_domain,
          po.whitelabel_config_json,
          po.status,
          pwc.brand_name as pwc_brand_name,
          pwc.logo_url,
          pwc.favicon_url,
          pwc.primary_color,
          pwc.accent_color,
          pwc.custom_email_sender,
          pwc.support_url,
          pwc.footer_html,
          pwc.is_ssl_active,
          pwc.portal_title,
          pwc.login_headline,
          pwc.login_subheading,
          pwc.custom_css
        FROM partner_organizations po
        LEFT JOIN partner_whitelabel_configs pwc ON pwc.partner_id = po.partner_id
        WHERE (LOWER(po.slug) = ?1 OR LOWER(pwc.agency_slug) = ?1) AND po.status = 'active'
        LIMIT 1`
      )
      .bind(cleanSlug)
      .first<{
        id: string;
        partner_id: string;
        name: string;
        slug: string | null;
        custom_domain: string | null;
        whitelabel_config_json: string | null;
        status: string;
        pwc_brand_name: string | null;
        logo_url: string | null;
        favicon_url: string | null;
        primary_color: string | null;
        accent_color: string | null;
        custom_email_sender: string | null;
        support_url: string | null;
        footer_html: string | null;
        is_ssl_active: number | null;
        portal_title: string | null;
        login_headline: string | null;
        login_subheading: string | null;
        custom_css: string | null;
      }>();

    if (orgRow) {
      let parsedJson: Record<string, unknown> = {};
      try {
        if (orgRow.whitelabel_config_json) {
          parsedJson = JSON.parse(orgRow.whitelabel_config_json) as Record<string, unknown>;
        }
      } catch {
        parsedJson = {};
      }

      const brand =
        (typeof parsedJson.brandName === 'string' && parsedJson.brandName.trim()) ||
        orgRow.pwc_brand_name ||
        orgRow.name;

      return {
        partnerId: orgRow.partner_id,
        agencySlug: orgRow.slug || cleanSlug,
        agencyName: orgRow.name,
        brandName: brand,
        logoUrl: (parsedJson.logoUrl as string) || orgRow.logo_url || null,
        faviconUrl: (parsedJson.faviconUrl as string) || orgRow.favicon_url || null,
        primaryColor: validateHexColor(
          (parsedJson.primaryColor as string) || orgRow.primary_color,
          '#06b6d4',
        ),
        secondaryColor: validateHexColor(
          (parsedJson.secondaryColor as string) || orgRow.accent_color,
          '#3b82f6',
        ),
        customDomain: orgRow.custom_domain,
        customEmailSender:
          (parsedJson.customEmailSender as string) || orgRow.custom_email_sender || null,
        supportUrl: (parsedJson.supportUrl as string) || orgRow.support_url || null,
        footerHtml: (parsedJson.footerHtml as string) || orgRow.footer_html || null,
        portalTitle: (parsedJson.portalTitle as string) || orgRow.portal_title || brand,
        loginHeadline: (parsedJson.loginHeadline as string) || orgRow.login_headline || null,
        loginSubheading: (parsedJson.loginSubheading as string) || orgRow.login_subheading || null,
        customCss: (parsedJson.customCss as string) || orgRow.custom_css || null,
        isSslActive: orgRow.is_ssl_active === 1,
      };
    }
  } catch {
    // Proceed to check partner_whitelabel_configs
  }

  // 2. Check partner_whitelabel_configs by agency_slug
  try {
    const whitelabelRow = await db
      .prepare(
        `SELECT
          pwc.id,
          pwc.partner_id,
          pwc.brand_name,
          pwc.logo_url,
          pwc.favicon_url,
          pwc.primary_color,
          pwc.accent_color,
          pwc.custom_domain,
          pwc.custom_email_sender,
          pwc.support_url,
          pwc.footer_html,
          pwc.is_ssl_active,
          pwc.agency_slug,
          pwc.portal_title,
          pwc.login_headline,
          pwc.login_subheading,
          pwc.custom_css,
          pp.partner_name
        FROM partner_whitelabel_configs pwc
        LEFT JOIN partner_profiles pp ON pp.id = pwc.partner_id
        WHERE LOWER(pwc.agency_slug) = ?1
        LIMIT 1`
      )
      .bind(cleanSlug)
      .first<{
        id: string;
        partner_id: string;
        brand_name: string;
        logo_url: string | null;
        favicon_url: string | null;
        primary_color: string | null;
        accent_color: string | null;
        custom_domain: string | null;
        custom_email_sender: string | null;
        support_url: string | null;
        footer_html: string | null;
        is_ssl_active: number;
        agency_slug: string | null;
        portal_title: string | null;
        login_headline: string | null;
        login_subheading: string | null;
        custom_css: string | null;
        partner_name: string | null;
      }>();

    if (whitelabelRow) {
      const brand = whitelabelRow.brand_name || whitelabelRow.partner_name || 'Agency Portal';
      return {
        partnerId: whitelabelRow.partner_id,
        agencySlug: whitelabelRow.agency_slug || cleanSlug,
        agencyName: whitelabelRow.partner_name || brand,
        brandName: brand,
        logoUrl: whitelabelRow.logo_url,
        faviconUrl: whitelabelRow.favicon_url,
        primaryColor: validateHexColor(whitelabelRow.primary_color, '#06b6d4'),
        secondaryColor: validateHexColor(whitelabelRow.accent_color, '#3b82f6'),
        customDomain: whitelabelRow.custom_domain,
        customEmailSender: whitelabelRow.custom_email_sender,
        supportUrl: whitelabelRow.support_url,
        footerHtml: whitelabelRow.footer_html,
        portalTitle: whitelabelRow.portal_title || brand,
        loginHeadline: whitelabelRow.login_headline,
        loginSubheading: whitelabelRow.login_subheading,
        customCss: whitelabelRow.custom_css,
        isSslActive: whitelabelRow.is_ssl_active === 1,
      };
    }
  } catch {
    // Not found
  }

  return null;
}

/**
 * Produces Next.js-compatible unbranded portal metadata without ANY vendor mentions.
 * Guarantees 0 strings of "Sophia AI Factory", "Sophia", or parent platform.
 */
export function renderUnbrandedPortalMetadata(
  config: Partial<UnbrandedAgencyPortalConfig> | null | undefined,
  locale = 'en',
): UnbrandedPortalMetadata {
  const isVi = locale === 'vi';
  const brandName = config?.brandName?.trim() || config?.agencyName?.trim() || (isVi ? 'Cổng Khách Hàng' : 'Client Portal');
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
