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
import {
  formatWhiteLabelEmail,
  escapeHtml,
} from '@/tree/branding/email-styler';
import type { WhiteLabelEmailBranding } from '@/tree/branding/email-styler';

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
    // 1. Try org_branding table
    const orgBranding = await db
      .prepare(
        `SELECT agency_name, logo_url, primary_color
         FROM org_branding
         WHERE org_id = ?1
         LIMIT 1`
      )
      .bind(tenantOrOrgId)
      .first<{ agency_name: string | null; logo_url: string | null; primary_color: string | null }>();

    // 2. Try tenant_settings namespace 'branding'
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

/**
 * Converts ResolvedEmailBranding to WhiteLabelEmailBranding for email-styler.
 */
export function toWhiteLabelBranding(branding: ResolvedEmailBranding): WhiteLabelEmailBranding {
  return {
    agencyName: branding.agencyName,
    logoUrl: branding.logoUrl,
    primaryColor: branding.primaryColor,
    accentColor: branding.accentColor,
    customDomain: branding.customDomain,
    supportEmail: branding.supportEmail,
    legalDisclaimer: branding.legalDisclaimer,
    unsubscribeUrl: branding.unsubscribeUrl,
    emailFooter: branding.footerMarkdown,
    emailFromName: branding.fromName,
    poweredBySophia: !branding.isWhiteLabel,
  };
}

/**
 * Format email with white-label layout using resolved tenant branding.
 */
export function formatTenantEmail(html: string, branding: ResolvedEmailBranding): string {
  return formatWhiteLabelEmail(html, toWhiteLabelBranding(branding));
}

/**
 * Append tenant email footer to an HTML body.
 * Escapes the footer markdown as plain text inside a styled block.
 * No-op if footerMarkdown is null.
 */
export function appendEmailFooter(html: string, footerMarkdown: string | null): string {
  if (!footerMarkdown) return html;
  const escaped = escapeHtml(footerMarkdown);
  const footerHtml = `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #374151;font-size:12px;color:#6b7280;white-space:pre-wrap;">${escaped}</div>`;
  return html.includes('</body>')
    ? html.replace('</body>', () => `${footerHtml}</body>`)
    : html + footerHtml;
}

/**
 * Build logo img tag for email header. No-op if logoUrl is null.
 */
export function buildLogoImgTag(logoUrl: string | null): string {
  if (!logoUrl) return '';
  return `<img src="${escapeHtml(logoUrl)}" alt="logo" style="max-height:40px;max-width:160px;display:block;margin-bottom:16px;" />`;
}
