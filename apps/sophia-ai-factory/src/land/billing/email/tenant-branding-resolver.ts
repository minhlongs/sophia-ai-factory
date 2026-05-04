/**
 * Resolves tenant branding for email send-time customization.
 * ADDITIVE — returns defaults if D1 unavailable or no branding set.
 * @module billing/email/tenant-branding-resolver
 */

import { getOrDefault } from '@/lib/tenant-settings/registry';
import { DEFAULT_BRANDING } from '@/lib/tenant-settings/defaults';
import type { BrandingSettings } from '@/lib/tenant-settings/defaults';
import { logger } from '@/seed/utils/logger-utility';

export interface ResolvedEmailBranding {
  fromName: string | null;
  footerMarkdown: string | null;
  logoUrl: string | null;
}

/** Get D1 from Cloudflare Workers globals. Returns null in non-CF environments. */
function getD1(): D1Database | null {
  try {
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
 * Resolve email branding fields for a tenant.
 * Safe to call from any email sender — returns nulls when unset.
 */
export async function resolveEmailBranding(tenantId: string): Promise<ResolvedEmailBranding> {
  const db = getD1();
  if (!db) {
    return { fromName: null, footerMarkdown: null, logoUrl: null };
  }

  try {
    const branding = await getOrDefault<BrandingSettings>(db, tenantId, 'branding', DEFAULT_BRANDING);
    return {
      fromName: branding.emailFromName ?? null,
      footerMarkdown: branding.emailFooter ?? null,
      logoUrl: branding.logoUrl ?? null,
    };
  } catch (err) {
    logger.warn('[tenant-branding-resolver] Failed to load branding', {
      tenantId,
      error: String(err),
    });
    return { fromName: null, footerMarkdown: null, logoUrl: null };
  }
}

/**
 * Append tenant email footer to an HTML body.
 * Escapes the footer markdown as plain text inside a styled block.
 * No-op if footerMarkdown is null.
 */
export function appendEmailFooter(html: string, footerMarkdown: string | null): string {
  if (!footerMarkdown) return html;
  // Escape HTML entities in footer text (basic XSS prevention)
  const escaped = footerMarkdown
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const footerHtml = `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #374151;font-size:12px;color:#6b7280;white-space:pre-wrap;">${escaped}</div>`;
  // Insert before closing </body> if present, otherwise append
  return html.includes('</body>')
    ? html.replace('</body>', `${footerHtml}</body>`)
    : html + footerHtml;
}

/**
 * Build logo img tag for email header. No-op if logoUrl is null.
 */
export function buildLogoImgTag(logoUrl: string | null): string {
  if (!logoUrl) return '';
  return `<img src="${logoUrl}" alt="logo" style="max-height:40px;max-width:160px;display:block;margin-bottom:16px;" />`;
}
