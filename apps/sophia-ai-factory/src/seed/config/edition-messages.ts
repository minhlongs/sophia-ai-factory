/**
 * Bilingual Messages for Open-Core Feature Gate Evaluations
 *
 * @module seed/config/edition-messages
 */

import type { OpenCoreFeatureSpec } from './open-core-manifest';

export function getFeatureGateMessages(
  feature: OpenCoreFeatureSpec,
  licensedTier?: string,
): {
  community: { vi: string; en: string };
  enterprise: { vi: string; en: string };
  cloud: { vi: string; en: string };
  locked: { vi: string; en: string };
} {
  const isEnterpriseOnly = feature.scope === 'ENTERPRISE_MASTER';
  return {
    community: {
      vi: `Tính năng "${feature.titleVi}" nằm trong gói Open-Core miễn phí (Apache-2.0).`,
      en: `Feature "${feature.titleEn}" is included in the free Open-Core Community Edition (Apache-2.0).`,
    },
    enterprise: {
      vi: `Đã mở khóa thương mại cho "${feature.titleVi}" qua giấy phép RaaS (${licensedTier}).`,
      en: `Commercial feature "${feature.titleEn}" unlocked via verified RaaS license (${licensedTier}).`,
    },
    cloud: {
      vi: `Tính năng "${feature.titleVi}" đang hoạt động trên Sophia Cloud (${licensedTier}).`,
      en: `Feature "${feature.titleEn}" is active on Sophia Managed Cloud (${licensedTier}).`,
    },
    locked: {
      vi: isEnterpriseOnly
        ? `🔒 "${feature.titleVi}" yêu cầu gói Enterprise ($799/tháng) hoặc Master Handover ($4,999).`
        : `☁️ "${feature.titleVi}" yêu cầu gói Sophia Cloud (từ $199/tháng) hoặc khóa bản quyền RaaS hợp lệ.`,
      en: isEnterpriseOnly
        ? `🔒 "${feature.titleEn}" requires Sophia Enterprise ($799/mo) or Master Handover ($4,999).`
        : `☁️ "${feature.titleEn}" requires an active Sophia Cloud subscription (from $199/mo) or a valid RaaS License Key.`,
    },
  };
}
