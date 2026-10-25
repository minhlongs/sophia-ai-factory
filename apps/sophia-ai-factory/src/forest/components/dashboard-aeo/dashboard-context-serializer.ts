/**
 * Safe Dashboard LLM Context Serializer (mode="authenticated-safe").
 * Resolves any of the 16+ Dashboard modules and produces a PII/BYOK-scrubbed
 * Markdown summary so CEOs can safely paste context into Claude/ChatGPT.
 * Layer: forest/components/dashboard-aeo
 */

import {
  redactSecretsFromRecord,
  redactSecretsFromText,
  VERIFIED_ISO_DATE,
} from '@/seed/aeo';
import {
  DASHBOARD_MODULES_CATALOG,
  type DashboardModuleDescriptor,
} from './dashboard-modules-catalog';

export { DASHBOARD_MODULES_CATALOG, type DashboardModuleDescriptor };

export function resolveDashboardModuleDescriptor(pathname: string): DashboardModuleDescriptor {
  const clean = pathname.replace(/^\/(en|vi)/, '').replace(/^\/dashboard\/?/, '');
  const firstSegment = clean.split('/')[0] || 'overview';
  if (firstSegment === 'affiliates') return DASHBOARD_MODULES_CATALOG.affiliate;
  return DASHBOARD_MODULES_CATALOG[firstSegment] ?? {
    slug: firstSegment,
    titleVi: `Phân Hệ Điều Hành: ${firstSegment.toUpperCase()}`,
    titleEn: `Operations Module: ${firstSegment.toUpperCase()}`,
    purposeVi: 'Không gian điều hành chuyên biệt thuộc hệ sinh thái Sophia AI Factory (Spatial Bento 2027).',
    purposeEn: 'Dedicated operational workspace inside Sophia AI Factory (Spatial Bento 2027).',
    recommendedPromptVi: 'Hãy tóm tắt trạng thái vận hành hiện tại và đề xuất bước tiếp theo cho CEO.',
    recommendedPromptEn: 'Summarize current operational status and suggest the next executive action.',
  };
}

export function serializeSafeDashboardContext(params: {
  pathname: string;
  isVi: boolean;
  tier?: string;
  quotaUsed?: number;
  quotaTotal?: number;
}): string {
  const mod = resolveDashboardModuleDescriptor(params.pathname);
  const safeMeta = redactSecretsFromRecord({
    moduleSlug: mod.slug,
    tier: params.tier ?? 'BASIC',
    mcuQuota: `${params.quotaUsed ?? 0} / ${params.quotaTotal ?? 1000} MCU`,
    securityMode: 'authenticated-safe (PII & BYOK keys strictly redacted)',
    verifiedDate: VERIFIED_ISO_DATE,
  });

  const rawMarkdown = [
    '---',
    `context_type: "sophia_dashboard_safe_export"`,
    `module: "${mod.slug}"`,
    `tier: "${safeMeta.tier}"`,
    `mcu_usage: "${safeMeta.mcuQuota}"`,
    `redaction_policy: "ZERO_SECRETS_PII_SCRUBBED"`,
    '---',
    '',
    `# ${params.isVi ? mod.titleVi : mod.titleEn}`,
    '',
    `> **${params.isVi ? 'Mục tiêu vận hành' : 'Operational Purpose'}:** ${params.isVi ? mod.purposeVi : mod.purposeEn}`,
    '',
    `## ${params.isVi ? 'Thông Số Phiên Làm Việc (Đã Ẩn Thông Tin Nhạy Cảm)' : 'Sanitized Session Telemetry'}`,
    `- **Tier:** ${safeMeta.tier}`,
    `- **MCU Quota:** ${safeMeta.mcuQuota}`,
    `- **Security Guard:** ${safeMeta.securityMode}`,
    '',
    `## ${params.isVi ? 'Gợi Ý Câu Lệnh Cho AI (Copy & Paste vào Claude / ChatGPT)' : 'Recommended Prompt for Your LLM'}`,
    '```text',
    params.isVi ? mod.recommendedPromptVi : mod.recommendedPromptEn,
    '```',
  ].join('\n');

  return redactSecretsFromText(rawMarkdown);
}
