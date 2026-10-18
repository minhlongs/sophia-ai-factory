/**
 * Customer Incident Classifier & Bilingual Telemetry Catalog.
 *
 * @module land/production-monitoring/customer-incident-classifier
 */

export type IncidentCategory =
  | 'KEY_EXPIRED_OR_INVALID'
  | 'PROVIDER_RATE_LIMIT'
  | 'QUOTA_EXHAUSTED'
  | 'NETWORK_TIMEOUT'
  | 'ASSET_VALIDATION_FAILED';

export interface CustomerIncident {
  id: string;
  category: IncidentCategory;
  service: string;
  whatHappened: string;
  whatHappenedVi: string;
  whatItMeans: string;
  whatItMeansVi: string;
  whatYouCanDo: string;
  whatYouCanDoVi: string;
  timestamp: string;
  retryActionUrl?: string;
  supportUrl?: string;
}

export interface CustomerSystemHealth {
  sophiaCore: 'READY' | 'DEGRADED';
  authentication: 'READY';
  aiProvider: 'READY' | 'ACTION_REQUIRED';
  storage: 'READY' | 'DEGRADED';
  videoPipeline: 'READY' | 'DEGRADED';
  billing: 'READY' | 'ACTION_REQUIRED';
  telegram: 'CONNECTED' | 'NOT_CONNECTED';
  incidents: CustomerIncident[];
  checkedAt: string;
}

export const CATEGORY_MAP: Record<IncidentCategory, {
  wh: string; whVi: string; wm: string; wmVi: string; cd: string; cdVi: string; retry: string;
}> = {
  KEY_EXPIRED_OR_INVALID: {
    wh: 'API key is expired or invalid.', whVi: 'Khóa API đã hết hạn hoặc không hợp lệ.',
    wm: 'Sophia cannot authenticate with the AI service using your provided key.',
    wmVi: 'Sophia không thể xác thực với dịch vụ AI bằng khóa đã cung cấp.',
    cd: 'Go to Settings → API Keys to update or replace your provider key.',
    cdVi: 'Vào Cài đặt → Khóa API để cập nhật hoặc thay thế khóa nhà cung cấp.',
    retry: '/setup',
  },
  PROVIDER_RATE_LIMIT: {
    wh: 'Upstream provider rate limit reached.', whVi: 'Bị giới hạn tốc độ từ nhà cung cấp dịch vụ.',
    wm: 'The provider is temporarily throttling requests due to high volume.',
    wmVi: 'Nhà cung cấp đang tạm thời giới hạn số lượng yêu cầu do lưu lượng cao.',
    cd: 'Wait a few minutes before retrying, or check your provider plan limits.',
    cdVi: 'Chờ vài phút trước khi thử lại, hoặc kiểm tra giới hạn gói nhà cung cấp.',
    retry: '/dashboard/missions',
  },
  QUOTA_EXHAUSTED: {
    wh: 'Credit balance or quota depleted.', whVi: 'Hạn mức hoặc số dư tín dụng đã hết.',
    wm: 'Your account or provider balance does not have enough credits to proceed.',
    wmVi: 'Tài khoản hoặc nhà cung cấp AI không còn đủ tín dụng để xử lý tác vụ.',
    cd: 'Top up your provider credits or upgrade your Sophia subscription plan.',
    cdVi: 'Nạp thêm tín dụng nhà cung cấp hoặc nâng cấp gói tài khoản Sophia.',
    retry: '/settings/usage',
  },
  NETWORK_TIMEOUT: {
    wh: 'Network connection timed out.', whVi: 'Hết thời gian chờ kết nối mạng.',
    wm: 'The request took longer than expected due to temporary network latency.',
    wmVi: 'Yêu cầu mất nhiều thời gian hơn dự kiến do độ trễ mạng tạm thời.',
    cd: 'Click Try Again below. If the issue persists, contact support.',
    cdVi: 'Bấm Thử lại bên dưới. Nếu sự cố tiếp diễn, hãy liên hệ hỗ trợ.',
    retry: '/dashboard/missions',
  },
  ASSET_VALIDATION_FAILED: {
    wh: 'Asset or prompt rejected by safety filter or invalid format.',
    whVi: 'Tài nguyên hoặc câu lệnh bị từ chối kiểm duyệt hoặc sai định dạng.',
    wm: 'Input content did not pass provider moderation or requires valid media formats.',
    wmVi: 'Nội dung không vượt qua bộ lọc an toàn hoặc cần định dạng tệp hợp lệ.',
    cd: 'Refine your prompt or upload media in standard formats (MP4, PNG, JPG).',
    cdVi: 'Tinh chỉnh lại câu lệnh hoặc sử dụng tệp đúng định dạng (MP4, PNG, JPG).',
    retry: '/dashboard/missions/new',
  },
};

/** Classifies raw errors into customer-safe categories without leaking secrets. */
export function classifyCustomerIncident(rawError: string, service = 'AI Provider'): Omit<CustomerIncident, 'id' | 'timestamp'> {
  const err = rawError.toLowerCase();
  let cat: IncidentCategory = 'NETWORK_TIMEOUT';
  if (/401|403|key|auth|unauthorized|expired/.test(err)) cat = 'KEY_EXPIRED_OR_INVALID';
  else if (/429|rate limit|too many|throttle/.test(err)) cat = 'PROVIDER_RATE_LIMIT';
  else if (/quota|credit|balance|insufficient|402/.test(err)) cat = 'QUOTA_EXHAUSTED';
  else if (/safety|filter|validation|nsfw|reject|format/.test(err)) cat = 'ASSET_VALIDATION_FAILED';

  const c = CATEGORY_MAP[cat];
  return {
    category: cat, service, whatHappened: c.wh, whatHappenedVi: c.whVi,
    whatItMeans: c.wm, whatItMeansVi: c.wmVi, whatYouCanDo: c.cd, whatYouCanDoVi: c.cdVi,
    retryActionUrl: c.retry, supportUrl: '/operations',
  };
}
