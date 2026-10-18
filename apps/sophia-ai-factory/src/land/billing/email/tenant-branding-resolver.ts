/**
 * Tenant Branding Resolver for Email Send-Time Customization
 *
 * Resolves tenant branding configurations from D1 org_branding & tenant_settings.
 * Delegates white-label HTML formatting to tree/branding/email-styler.
 * Preserves 100% backward compatibility with existing callers.
 *
 * Layer: land (business orchestration)
 * Allowed imports: @/seed/*, @/tree/*
 *
 * @module billing/email/tenant-branding-resolver
 */

import { getOrDefault } from '@/seed/tenant-settings/registry';
import { DEFAULT_BRANDING } from '@/seed/tenant-settings/defaults';
import type { BrandingSettings } from '@/seed/tenant-settings/defaults';
import { logger } from '@/seed/utils/logger-utility';

export {
  toWhiteLabelBranding,
  formatTenantEmail,
  appendEmailFooter,
  buildLogoImgTag,
} from './tenant-branding-formatter';

export interface ResolvedEmailBranding {
  fromName: string | null;
  footerMarkdown: string | null;
  logoUrl: string | null;
  agencyName?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  customDomain?: string | null;
  supportEmail?: string | null;
  legalDisclaimer?: string | null;
  unsubscribeUrl?: string | null;
  isWhiteLabel?: boolean;
}

/** Get D1 from Cloudflare Workers globals. Returns null in non-CF environments. */
function getD1(): D1Database | null {
  try {
    const envDouble = (globalThis as unknown as Record<string, Record<string, unknown>>).__env__;
    if (envDouble?.DB) return envDouble.DB as D1Database;
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[
      Symbol.for('__cloudflare-context__')
    ];
    if (ctx?.env?.DB) return ctx.env.DB as D1Database;
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve email branding fields for a tenant or organization.
 * Queries org_branding table first, falling back to tenant_settings.
 * Safe to call from any email sender — returns nulls when unset.
 */
export async function resolveEmailBranding(tenantOrOrgId: string): Promise<ResolvedEmailBranding> {
  const db = getD1();

  if (!db || !tenantOrOrgId) {
    return { fromName: null, footerMarkdown: null, logoUrl: null };
  }

  try {
    const orgBranding = await db
      .prepare(
        `SELECT agency_name, logo_url, primary_color
         FROM org_branding
         WHERE org_id = ?1
         LIMIT 1`
      )
      .bind(tenantOrOrgId)
      .first<{ agency_name: string | null; logo_url: string | null; primary_color: string | null }>();

    const settings = await getOrDefault<BrandingSettings>(
      db,
      tenantOrOrgId,
      'branding',
      DEFAULT_BRANDING
    ).catch(() => DEFAULT_BRANDING);

    const agencyName = orgBranding?.agency_name ?? settings.agencyName ?? null;
    const logoUrl = orgBranding?.logo_url ?? settings.logoUrl ?? null;
    const primaryColor = orgBranding?.primary_color ?? settings.primaryColor ?? null;
    const isWhiteLabel = Boolean(agencyName || logoUrl || settings.customDomain);

    return {
      fromName: settings.emailFromName ?? agencyName ?? null,
      footerMarkdown: settings.emailFooter ?? null,
      logoUrl,
      agencyName,
      primaryColor,
      accentColor: settings.accentColor ?? null,
      customDomain: settings.customDomain ?? null,
      supportEmail: null,
      legalDisclaimer: settings.emailFooter ?? null,
      unsubscribeUrl: null,
      isWhiteLabel,
    };
  } catch (err) {
    logger.warn('[tenant-branding-resolver] Failed to load branding', {
      tenantOrOrgId,
      error: String(err),
    });
    return { fromName: null, footerMarkdown: null, logoUrl: null };
  }
}
