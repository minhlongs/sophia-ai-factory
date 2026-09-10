/**
 * Customer Health Summary — Non-technical CEO System Telemetry.
 * Exposes safe operational status without leaking secrets, strings, or tenant data.
 *
 * @module land/production-monitoring/customer-health-summary
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

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

const CATEGORY_MAP: Record<IncidentCategory, {
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

/** Aggregates safe operational telemetry for a customer. */
export async function getCustomerHealthSummary(userId: string): Promise<CustomerSystemHealth> {
  const now = new Date().toISOString();
  const incidents: CustomerIncident[] = [];
  let aiStatus: 'READY' | 'ACTION_REQUIRED' = 'READY';
  let pipeStatus: 'READY' | 'DEGRADED' = 'READY';
  let billStatus: 'READY' | 'ACTION_REQUIRED' = 'READY';
  let tgStatus: 'CONNECTED' | 'NOT_CONNECTED' = 'NOT_CONNECTED';
  let coreStatus: 'READY' | 'DEGRADED' = 'READY';

  try {
    const db = createServerClient();
    const keyRows = await db.prepare('SELECT provider FROM user_api_keys WHERE user_id = ?1').bind(userId).all<{ provider: string }>();
    if (!keyRows.results?.length) {
      aiStatus = 'ACTION_REQUIRED';
      incidents.push({
        id: 'inc-byok-empty', ...CATEGORY_MAP.KEY_EXPIRED_OR_INVALID,
        category: 'KEY_EXPIRED_OR_INVALID', service: 'AI Provider BYOK',
        whatHappened: 'No AI provider API keys configured.', whatHappenedVi: 'Chưa cấu hình khóa API cho nhà cung cấp AI nào.',
        whatItMeans: 'Sophia cannot generate videos until at least one key is added.',
        whatItMeansVi: 'Sophia chưa thể tạo video khi chưa có khóa API.',
        whatYouCanDo: 'Complete the setup wizard or add your API keys in Settings.',
        whatYouCanDoVi: 'Hoàn tất trình cài đặt hoặc thêm khóa API trong Cài đặt.',
        timestamp: now, retryActionUrl: '/setup', supportUrl: '/operations',
      });
    }

    const jobs = await db.prepare('SELECT id, status, error, created_at FROM video_jobs WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 5').bind(userId).all<{ id: string; status: string; error: string | null; created_at: number }>();
    const failed = jobs.results?.find((j) => j.status === 'failed');
    if (failed) {
      pipeStatus = 'DEGRADED';
      incidents.push({ id: `inc-job-${failed.id}`, ...classifyCustomerIncident(failed.error ?? '', 'Video Pipeline'), timestamp: new Date(failed.created_at).toISOString() });
    }

    const sub = await db.prepare('SELECT status FROM subscriptions WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 1').bind(userId).first<{ status: string }>();
    if (sub && (sub.status === 'past_due' || sub.status === 'unpaid')) {
      billStatus = 'ACTION_REQUIRED';
      incidents.push({
        id: 'inc-sub-past-due', category: 'QUOTA_EXHAUSTED', service: 'Billing & Subscription',
        whatHappened: 'Subscription payment is past due.', whatHappenedVi: 'Thanh toán gói đăng ký đã quá hạn.',
        whatItMeans: 'Account features may be paused until invoice is settled.', whatItMeansVi: 'Các tính năng có thể bị tạm dừng đến khi hóa đơn được thanh toán.',
        whatYouCanDo: 'Review payment details and settle outstanding invoices.', whatYouCanDoVi: 'Kiểm tra thông tin thanh toán và thanh toán hóa đơn chưa tất toán.',
        timestamp: now, retryActionUrl: '/settings/usage', supportUrl: '/operations',
      });
    }

    const tg = await db.prepare('SELECT chat_id FROM telegram_paired_chats WHERE paired_by = ?1 LIMIT 1').bind(userId).first<{ chat_id: string }>();
    if (tg?.chat_id) tgStatus = 'CONNECTED';
  } catch (err) {
    logger.warn('Failed to resolve customer health summary', { error: toError(err).message });
    coreStatus = 'DEGRADED';
  }

  return { sophiaCore: coreStatus, authentication: 'READY', aiProvider: aiStatus, storage: 'READY', videoPipeline: pipeStatus, billing: billStatus, telegram: tgStatus, incidents, checkedAt: now };
}
