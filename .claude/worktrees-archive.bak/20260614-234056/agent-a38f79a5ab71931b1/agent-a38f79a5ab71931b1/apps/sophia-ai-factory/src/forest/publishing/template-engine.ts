/**
 * Template engine for per-tenant channel caption/title rendering.
 * Supports {varName} substitution with tenant-defined templates stored in
 * the 'channels' settings namespace.
 *
 * @module lib/publishing/template-engine
 */

import { getOrDefault } from '@/seed/tenant-settings/registry';
import type { ChannelProvider, ChannelsSettings } from '@/seed/tenant-settings/defaults';

/** Variables available for template substitution. */
export type TemplateVars = {
  productName?: string;
  commission?: string;
  network?: string;
  cookieDays?: string;
  ctaUrl?: string;
  tenantName?: string;
  [key: string]: string | undefined;
};

/**
 * Substitute {varName} placeholders in a template string.
 * Unknown vars are left as-is (empty string substitution would hide bugs).
 */
export function renderTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (match, key: string) => {
    const val = vars[key];
    return val !== undefined ? val : match;
  });
}

/**
 * Determine effective caption for a channel publish.
 *
 * Resolution order:
 * 1. If tenant has a captionTemplate AND preferTemplateOverAI is true → render template
 * 2. Otherwise fall through to fallbackAI (AI-generated caption)
 */
export async function getEffectiveCaption(
  db: D1Database,
  tenantId: string,
  channel: ChannelProvider,
  fallbackAI: string,
  vars: TemplateVars,
): Promise<string> {
  const settings = await getOrDefault<ChannelsSettings>(db, tenantId, 'channels');

  if (!settings.preferTemplateOverAI) return fallbackAI;

  const tpl = settings.templates?.[channel];
  if (!tpl?.captionTemplate) return fallbackAI;

  return renderTemplate(tpl.captionTemplate, vars);
}

/**
 * Determine effective title for a channel publish.
 *
 * Resolution order:
 * 1. If tenant has a titleTemplate AND preferTemplateOverAI is true → render template
 * 2. Otherwise fall through to fallbackAI (AI-generated title / caption snippet)
 */
export async function getEffectiveTitle(
  db: D1Database,
  tenantId: string,
  channel: ChannelProvider,
  fallbackAI: string,
  vars: TemplateVars,
): Promise<string> {
  const settings = await getOrDefault<ChannelsSettings>(db, tenantId, 'channels');

  if (!settings.preferTemplateOverAI) return fallbackAI;

  const tpl = settings.templates?.[channel];
  if (!tpl?.titleTemplate) return fallbackAI;

  return renderTemplate(tpl.titleTemplate, vars);
}

/**
 * Determine effective hashtags string for a channel publish.
 * Returns comma/space-separated string; caller splits as needed.
 */
export async function getEffectiveHashtags(
  db: D1Database,
  tenantId: string,
  channel: ChannelProvider,
  fallbackAI: string,
  vars: TemplateVars,
): Promise<string> {
  const settings = await getOrDefault<ChannelsSettings>(db, tenantId, 'channels');

  if (!settings.preferTemplateOverAI) return fallbackAI;

  const tpl = settings.templates?.[channel];
  if (!tpl?.hashtagsTemplate) return fallbackAI;

  return renderTemplate(tpl.hashtagsTemplate, vars);
}
