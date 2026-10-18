/**
 * Customer Health Summary — Non-technical CEO System Telemetry.
 * Exposes safe operational status without leaking secrets, strings, or tenant data.
 *
 * @module land/production-monitoring/customer-health-summary
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  CATEGORY_MAP,
  classifyCustomerIncident,
  type IncidentCategory,
  type CustomerIncident,
  type CustomerSystemHealth,
} from './customer-incident-classifier';

export { classifyCustomerIncident };
export type { IncidentCategory, CustomerIncident, CustomerSystemHealth };

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

    const missions = await db.prepare('SELECT id, status, error, created_at FROM engine_missions WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 5').bind(userId).all<{ id: string; status: string; error: string | null; created_at: number }>();
    const failedMission = missions.results?.find((m) => m.status === 'failed');
    if (failedMission) {
      pipeStatus = 'DEGRADED';
      incidents.push({ id: `inc-job-${failedMission.id}`, ...classifyCustomerIncident(failedMission.error ?? '', 'Video Pipeline'), timestamp: new Date(failedMission.created_at * 1000).toISOString() });
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
