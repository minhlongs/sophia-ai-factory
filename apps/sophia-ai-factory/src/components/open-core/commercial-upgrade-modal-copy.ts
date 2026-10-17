/**
 * Bilingual Copy for Commercial Upgrade Modal
 *
 * @module components/open-core/commercial-upgrade-modal-copy
 */

export const UPGRADE_MODAL_COPY = {
  vi: {
    badge: 'SOPHIA CLOUD & ENTERPRISE EDITION',
    cloudCta: 'Nâng cấp trên Sophia Managed Cloud',
    licenseLabel: 'Hoặc kiểm tra tính hợp lệ của Khóa Giấy Phép RaaS (Xem trước — không tự lưu):',
    licensePlaceholder: 'SOPHIA-RAAS-v1.eyJ...',
    validateBtn: 'Kiểm tra Khóa (Preview)',
    validatingBtn: 'Đang kiểm tra...',
    persistHint:
      'Lưu ý: Bước này chỉ xác thực chữ ký HMAC và phạm vi Tier của khóa. Để kích hoạt vĩnh viễn trên máy chủ tự vận hành, hãy đặt RAAS_LICENSE_KEY trong biến môi trường.',
    closeBtn: 'Đóng',
    benefitsTitle: 'Đặc quyền khi nâng cấp lên Sophia Managed Cloud:',
    benefits: [
      'Hạ tầng Cloudflare D1 + R2 + Inngest vận hành sẵn (không cần tự quản lý queue/worker)',
      'Growth Triad v14: Thompson Sampling Bandit & phân bổ ngân sách Half-Kelly',
      'White-Label Agency Subaccount Portal, Custom Domain & Merkle IPO Audit Vault',
    ],
  },
  en: {
    badge: 'SOPHIA CLOUD & ENTERPRISE EDITION',
    cloudCta: 'Upgrade on Sophia Managed Cloud',
    licenseLabel: 'Or validate a RaaS Commercial License Key (Preview Only — stateless):',
    licensePlaceholder: 'SOPHIA-RAAS-v1.eyJ...',
    validateBtn: 'Validate Key (Preview)',
    validatingBtn: 'Validating...',
    persistHint:
      'Note: This check previews HMAC signature and tier entitlements only. For persistent activation on a self-hosted server, set RAAS_LICENSE_KEY in your server environment.',
    closeBtn: 'Close',
    benefitsTitle: 'Included with Sophia Managed Cloud & Enterprise:',
    benefits: [
      'Managed Cloudflare D1 + R2 + Inngest queue execution with zero DevOps maintenance',
      'Growth Triad v14: Thompson Sampling Bandit & Half-Kelly capital allocator',
      'White-Label Agency Subaccount Portal, Custom Domains & Merkle IPO Audit Vault',
    ],
  },
} as const;
