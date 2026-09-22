/**
 * Customer Retention Service & Anti-Churn AI Guardian
 *
 * Implements Requirement R1:
 * 1. 4-factor Customer Health Scoring (0–100):
 *    - Recency (0-25): Days since last login/session
 *    - Velocity (0-25): Video generation output in past 14/30 days
 *    - Capacity (0-25): MCU balance remaining vs total purchased/limit
 *    - Reliability (0-25): Render job success rate (completed vs failed jobs)
 * 2. Threshold Detection & Automated Win-Back Triggers:
 *    - Detects customers with Health Score < 40 (CRITICAL_CHURN_RISK)
 *    - Enforces 7-day anti-spam cooldown protection
 *    - Dispatches targeted Resend email & Telegram alert
 * 3. 1-Click Founder Intervention:
 *    - Grants bonus MCU credits via atomic credit repository
 *    - Dispatches personal founder outreach & records audit log
 *
 * Layer: land (Domain aggregation, imports seed and tree)
 *
 * @module land/growth/customer-retention-service
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  ChurnRiskLevel,
  HealthFactorBreakdown,
  RawCustomerActivityMetrics,
  CustomerHealthMetrics,
  WinBackTriggerResult,
  FounderInterventionRequest,
  FounderInterventionResult,
  RetentionSummaryStats,
} from '@/seed/types/retention-types';
import { sendEmail } from '@/tree/email/sender';
import { sendTelegramMessage } from '@/tree/telegram/telegram-client';
import { addCredits, getBalance } from '@/tree/mcu/credits-repo';

export const CHURN_HEALTH_THRESHOLD = 40;
export const WARNING_HEALTH_THRESHOLD = 70;
export const WINBACK_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days anti-spam cooldown

/**
 * Escapes special HTML characters to prevent XSS / HTML injection in email templates.
 */
export function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escapes Telegram Markdown control characters to prevent formatting breakage.
 */
export function escapeTelegramMarkdown(text: string): string {
  if (!text) return '';
  return text.replace(/([_*\[\]`\\])/g, '\\$1');
}

/**
 * Safely parses and bounds dates to prevent unhandled RangeError on invalid / extreme numbers.
 */
function computeSafeLastActiveAt(rawLastActiveAt: string | null | undefined, daysSinceLastActive: number): string {
  if (rawLastActiveAt) {
    try {
      const d = new Date(rawLastActiveAt);
      if (!Number.isNaN(d.getTime())) {
        return d.toISOString();
      }
    } catch {
      // Fall through to days calculation
    }
  }

  if (Number.isFinite(daysSinceLastActive) && daysSinceLastActive >= -36500 && daysSinceLastActive <= 36500) {
    try {
      const targetTime = Date.now() - daysSinceLastActive * 86400000;
      const d = new Date(targetTime);
      if (!Number.isNaN(d.getTime())) {
        return d.toISOString();
      }
    } catch {
      // Fall through to fallback
    }
  }

  return new Date().toISOString();
}

/**
 * 1. Factor: Recency Score (0 - 25)
 * Based on days elapsed since last session/login activity.
 * <= 1 day: 25 pts | <= 3 days: 20 pts | <= 7 days: 15 pts | <= 14 days: 10 pts | <= 30 days: 5 pts | > 30 days: 0 pts
 */
export function calculateRecencyScore(daysSinceLastActive: number): number {
  if (!Number.isFinite(daysSinceLastActive)) return 0;
  if (daysSinceLastActive < 0) return 25;
  if (daysSinceLastActive <= 1) return 25;
  if (daysSinceLastActive <= 3) return 20;
  if (daysSinceLastActive <= 7) return 15;
  if (daysSinceLastActive <= 14) return 10;
  if (daysSinceLastActive <= 30) return 5;
  return 0;
}

/**
 * 2. Factor: Velocity Score (0 - 25)
 * Based on video creation output volume in trailing 30 days.
 * >= 10 videos: 25 pts | >= 5 videos: 20 pts | >= 2 videos: 15 pts | >= 1 video: 10 pts | 0 videos: 0 pts
 */
export function calculateVelocityScore(videosCount30d: number): number {
  if (!Number.isFinite(videosCount30d) || videosCount30d <= 0) return 0;
  if (videosCount30d >= 10) return 25;
  if (videosCount30d >= 5) return 20;
  if (videosCount30d >= 2) return 15;
  if (videosCount30d >= 1) return 10;
  return 0;
}

/**
 * 3. Factor: Capacity Score (0 - 25)
 * Based on remaining MCU credits balance relative to purchased/allowance.
 * ratio >= 0.5: 25 pts | ratio >= 0.2: 20 pts | ratio >= 0.1: 15 pts | > 0: 10 pts | == 0: 0 pts
 */
export function calculateCapacityScore(creditsRemaining: number, creditsPurchased: number): number {
  if (Number.isNaN(creditsRemaining) || creditsRemaining <= 0) return 0;
  if (!Number.isFinite(creditsRemaining)) {
    return creditsRemaining > 0 ? 25 : 0;
  }

  if (Number.isFinite(creditsPurchased) && creditsPurchased > 0) {
    const ratio = creditsRemaining / creditsPurchased;
    if (ratio >= 0.5) return 25;
    if (ratio >= 0.2) return 20;
    if (ratio >= 0.1) return 15;
    return 10;
  }

  // Baseline when purchased is not recorded or free grant
  if (creditsRemaining >= 500) return 25;
  if (creditsRemaining >= 200) return 20;
  if (creditsRemaining >= 100) return 15;
  return 10;
}

/**
 * 4. Factor: Reliability Score (0 - 25)
 * Based on render job success rate (completed vs failed jobs).
 * >= 95%: 25 pts | >= 85%: 20 pts | >= 70%: 15 pts | >= 50%: 10 pts | < 50%: 5 pts
 * If no jobs run yet: 20 pts (neutral baseline, zero render failures)
 */
export function calculateReliabilityScore(completedJobs: number, failedJobs: number): number {
  const total = completedJobs + failedJobs;
  if (total === 0) return 20;

  const successRate = completedJobs / total;
  if (successRate >= 0.95) return 25;
  if (successRate >= 0.85) return 20;
  if (successRate >= 0.70) return 15;
  if (successRate >= 0.50) return 10;
  return 5;
}

/**
 * Pure calculation function: determines 4 health factor scores and status.
 */
export function computeCustomerHealth(raw: RawCustomerActivityMetrics): CustomerHealthMetrics {
  const recencyScore = calculateRecencyScore(raw.daysSinceLastActive);
  const velocityScore = calculateVelocityScore(raw.videosCreated30d);
  const capacityScore = calculateCapacityScore(raw.creditsRemaining, raw.creditsPurchased);
  const reliabilityScore = calculateReliabilityScore(raw.completedJobs, raw.failedJobs);

  const rawSum = recencyScore + velocityScore + capacityScore + reliabilityScore;
  const isScoreFinite = Number.isFinite(rawSum);
  const totalHealthScore = isScoreFinite
    ? Math.max(0, Math.min(100, rawSum))
    : 0;

  let status: ChurnRiskLevel = 'HEALTHY';
  if (!isScoreFinite || totalHealthScore < CHURN_HEALTH_THRESHOLD) {
    status = 'CRITICAL_CHURN_RISK';
  } else if (totalHealthScore < WARNING_HEALTH_THRESHOLD) {
    status = 'WARNING';
  }

  const breakdown: HealthFactorBreakdown = {
    recency: recencyScore,
    velocity: velocityScore,
    capacity: capacityScore,
    reliability: reliabilityScore,
  };

  return {
    userId: raw.userId,
    userEmail: raw.userEmail,
    userName: raw.userName ?? undefined,
    recencyScore,
    velocityScore,
    capacityScore,
    reliabilityScore,
    totalHealthScore,
    status,
    lastActiveAt: computeSafeLastActiveAt(raw.lastActiveAt, raw.daysSinceLastActive),
    breakdown,
    rawMetrics: raw,
  };
}

/**
 * Checks whether an anti-churn win-back outreach was dispatched within the cooldown window.
 */
export async function checkWinBackCooldown(
  userId: string,
  cooldownMs: number = WINBACK_COOLDOWN_MS,
): Promise<{ inCooldown: boolean; lastWinBackAt?: string }> {
  try {
    const db = await getD1();
    if (!db) return { inCooldown: false };

    const stmt = db.prepare(
      `SELECT created_at, payload FROM admin_audit_log 
       WHERE target_user_id = ? AND action_type = 'anti_churn_win_back'
       ORDER BY created_at DESC LIMIT 1`,
    );
    const row = await stmt.bind(userId).first<{ created_at: number; payload: string | null }>();

    if (!row) {
      return { inCooldown: false };
    }

    const lastTimestampMs = row.created_at > 10000000000 ? row.created_at : row.created_at * 1000;
    const elapsed = Date.now() - lastTimestampMs;

    return {
      inCooldown: elapsed < cooldownMs,
      lastWinBackAt: new Date(lastTimestampMs).toISOString(),
    };
  } catch (err) {
    logger.warn('[CustomerRetentionService] checkWinBackCooldown error', { userId, err: String(err) });
    return { inCooldown: false };
  }
}

/**
 * Records win-back outreach event to admin_audit_log for auditability & cooldown enforcement.
 */
export async function recordWinBackOutreach(
  userId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const db = await getD1();
    if (!db) return;

    await db.prepare(
      `INSERT INTO admin_audit_log (id, actor_user_id, action_type, target_user_id, payload, created_at)
       VALUES (lower(hex(randomblob(16))), 'system_anti_churn_guardian', 'anti_churn_win_back', ?, ?, strftime('%s','now'))`,
    ).bind(userId, JSON.stringify(payload)).run();
  } catch (err) {
    logger.error('[CustomerRetentionService] recordWinBackOutreach error', { userId, err: String(err) });
  }
}

/**
 * Fetches raw telemetry metrics for a specific user from D1.
 */
export async function fetchRawCustomerMetrics(
  userId: string,
): Promise<RawCustomerActivityMetrics | null> {
  const db = await getD1();
  if (!db) {
    logger.warn('[CustomerRetentionService] D1 binding unavailable');
    return null;
  }

  try {
    // 1. Fetch user profile
    const userRow = await db.prepare(
      'SELECT id, email, name, createdAt FROM "user" WHERE id = ?',
    ).bind(userId).first<{ id: string; email: string; name: string | null; createdAt: string | null }>();

    if (!userRow) {
      return null;
    }

    const nowMs = Date.now();
    const window30dSec = Math.floor((nowMs - 30 * 86400000) / 1000);

    // 2. Fetch last active session or streak
    let lastActiveMs: number | null = null;
    try {
      const sessionRow = await db.prepare(
        'SELECT updatedAt, createdAt FROM "session" WHERE userId = ? ORDER BY createdAt DESC LIMIT 1',
      ).bind(userId).first<{ updatedAt: string | null; createdAt: string | null }>();

      if (sessionRow?.updatedAt) {
        lastActiveMs = new Date(sessionRow.updatedAt).getTime();
      } else if (sessionRow?.createdAt) {
        lastActiveMs = new Date(sessionRow.createdAt).getTime();
      }
    } catch {
      // Non-fatal
    }

    try {
      const streakRow = await db.prepare(
        'SELECT last_activity_date, updated_at FROM user_streaks WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1',
      ).bind(userId).first<{ last_activity_date: string | null; updated_at: number | null }>();

      if (streakRow?.last_activity_date) {
        const streakTime = new Date(streakRow.last_activity_date).getTime();
        if (!isNaN(streakTime) && (!lastActiveMs || streakTime > lastActiveMs)) {
          lastActiveMs = streakTime;
        }
      }
    } catch {
      // Non-fatal
    }

    if (!lastActiveMs && userRow.createdAt) {
      lastActiveMs = new Date(userRow.createdAt).getTime();
    }

    const daysSinceLastActive = lastActiveMs
      ? Math.max(0, Math.floor((nowMs - lastActiveMs) / (86400 * 1000)))
      : 45;

    // 3. Fetch video velocity in trailing 30 days
    let videosCreated30d = 0;
    try {
      const videoRow = await db.prepare(
        'SELECT COUNT(*) as cnt FROM videos WHERE user_id = ? AND created_at >= ?',
      ).bind(userId, window30dSec).first<{ cnt: number }>();
      videosCreated30d = videoRow?.cnt ?? 0;
    } catch {
      // Non-fatal
    }

    // 4. Fetch MCU balance & consumption
    const balance = await getBalance(userId);
    const creditsRemaining = balance.credits_remaining;
    const creditsPurchased = balance.credits_total_purchased;

    // 5. Fetch render reliability
    let completedJobs = 0;
    let failedJobs = 0;

    try {
      const videoJobsRows = await db.prepare(
        'SELECT status, COUNT(*) as cnt FROM video_jobs WHERE user_id = ? GROUP BY status',
      ).bind(userId).all<{ status: string; cnt: number }>();

      if (videoJobsRows.results && videoJobsRows.results.length > 0) {
        for (const row of videoJobsRows.results) {
          if (row.status === 'published' || row.status === 'uploaded' || row.status === 'completed') {
            completedJobs += row.cnt;
          } else if (row.status === 'failed') {
            failedJobs += row.cnt;
          }
        }
      }
    } catch {
      // Non-fatal fallback to videos table
    }

    if (completedJobs === 0 && failedJobs === 0) {
      try {
        const videosRows = await db.prepare(
          'SELECT status, COUNT(*) as cnt FROM videos WHERE user_id = ? GROUP BY status',
        ).bind(userId).all<{ status: string; cnt: number }>();

        if (videosRows.results) {
          for (const row of videosRows.results) {
            if (row.status === 'completed') completedJobs += row.cnt;
            if (row.status === 'failed') failedJobs += row.cnt;
          }
        }
      } catch {
        // Non-fatal
      }
    }

    const totalJobs = completedJobs + failedJobs;
    const renderSuccessRate = totalJobs > 0 ? completedJobs / totalJobs : 1.0;

    return {
      userId,
      userEmail: userRow.email,
      userName: userRow.name,
      lastActiveAt: lastActiveMs ? new Date(lastActiveMs).toISOString() : null,
      daysSinceLastActive,
      videosCreated30d,
      creditsRemaining,
      creditsPurchased,
      totalJobs,
      completedJobs,
      failedJobs,
      renderSuccessRate,
    };
  } catch (err) {
    logger.error('[CustomerRetentionService] fetchRawCustomerMetrics failed', { userId, err: String(err) });
    return null;
  }
}

/**
 * Gets computed health metrics for a single customer.
 */
export async function getCustomerHealthMetrics(
  userId: string,
): Promise<CustomerHealthMetrics | null> {
  const raw = await fetchRawCustomerMetrics(userId);
  if (!raw) return null;

  const metrics = computeCustomerHealth(raw);
  const cooldown = await checkWinBackCooldown(userId);
  metrics.inCooldown = cooldown.inCooldown;
  metrics.lastWinBackAt = cooldown.lastWinBackAt;

  return metrics;
}

/**
 * Lists health metrics for all monitored customers with filtering options.
 */
export async function listAllCustomerHealthMetrics(options?: {
  minScore?: number;
  maxScore?: number;
  riskLevel?: ChurnRiskLevel;
  limit?: number;
}): Promise<CustomerHealthMetrics[]> {
  const db = await getD1();
  if (!db) return [];

  const limit = options?.limit ?? 50;

  try {
    const users = await db.prepare(
      'SELECT id FROM "user" ORDER BY createdAt DESC LIMIT ?',
    ).bind(limit * 2).all<{ id: string }>();

    if (!users.results || users.results.length === 0) {
      return [];
    }

    const list: CustomerHealthMetrics[] = [];
    for (const u of users.results) {
      const metric = await getCustomerHealthMetrics(u.id);
      if (!metric) continue;

      if (options?.riskLevel && metric.status !== options.riskLevel) {
        continue;
      }
      if (options?.minScore !== undefined && metric.totalHealthScore < options.minScore) {
        continue;
      }
      if (options?.maxScore !== undefined && metric.totalHealthScore > options.maxScore) {
        continue;
      }

      list.push(metric);
      if (list.length >= limit) break;
    }

    // Sort most critical risk first
    return list.sort((a, b) => a.totalHealthScore - b.totalHealthScore);
  } catch (err) {
    logger.error('[CustomerRetentionService] listAllCustomerHealthMetrics failed', { err: String(err) });
    return [];
  }
}

/**
 * Computes high-level retention & churn risk summary statistics.
 */
export async function getRetentionSummaryStats(): Promise<RetentionSummaryStats> {
  const all = await listAllCustomerHealthMetrics({ limit: 100 });
  const total = all.length;

  let healthy = 0;
  let warning = 0;
  let critical = 0;
  let sumScore = 0;
  let validScoreCount = 0;
  let winBackEligible = 0;

  for (const item of all) {
    if (Number.isFinite(item.totalHealthScore)) {
      sumScore += item.totalHealthScore;
      validScoreCount++;
    }
    if (item.status === 'HEALTHY') healthy++;
    else if (item.status === 'WARNING') warning++;
    else if (item.status === 'CRITICAL_CHURN_RISK') {
      critical++;
      if (!item.inCooldown) winBackEligible++;
    }
  }

  const averageHealthScore = validScoreCount > 0
    ? Math.round(sumScore / validScoreCount)
    : (total > 0 ? 0 : 100);

  return {
    totalMonitored: total,
    healthyCount: healthy,
    warningCount: warning,
    criticalRiskCount: critical,
    averageHealthScore,
    winBackEligibleCount: winBackEligible,
    lastScanTimestamp: new Date().toISOString(),
  };
}

// Set to track in-flight dispatches within current isolate to prevent intra-process TOCTOU races
const inFlightDispatches = new Set<string>();

/**
 * Dispatches targeted win-back outreach (Resend Email & Founder Telegram Alert).
 */
export async function dispatchWinBackOutreach(
  customer: CustomerHealthMetrics,
  options?: { dryRun?: boolean },
): Promise<WinBackTriggerResult> {
  const nowStr = new Date().toISOString();

  // Guard: Must be at churn risk (< 40)
  // Non-finite or NaN total score is treated as CRITICAL_CHURN_RISK (never masked as healthy)
  if (Number.isFinite(customer.totalHealthScore) && customer.totalHealthScore >= CHURN_HEALTH_THRESHOLD) {
    return {
      userId: customer.userId,
      userEmail: customer.userEmail,
      emailSent: false,
      telegramNotified: false,
      timestamp: nowStr,
      healthScore: customer.totalHealthScore,
      skippedReason: 'NOT_AT_RISK',
    };
  }

  // Guard: Intra-process in-flight concurrency lock
  if (inFlightDispatches.has(customer.userId)) {
    return {
      userId: customer.userId,
      userEmail: customer.userEmail,
      emailSent: false,
      telegramNotified: false,
      timestamp: nowStr,
      healthScore: customer.totalHealthScore,
      skippedReason: 'COOLDOWN_ACTIVE',
    };
  }

  inFlightDispatches.add(customer.userId);

  try {
    // Guard: Anti-spam cooldown in D1 audit log
    const cooldown = await checkWinBackCooldown(customer.userId);
    if (cooldown.inCooldown) {
      return {
        userId: customer.userId,
        userEmail: customer.userEmail,
        emailSent: false,
        telegramNotified: false,
        timestamp: nowStr,
        healthScore: customer.totalHealthScore,
        skippedReason: 'COOLDOWN_ACTIVE',
      };
    }

    if (options?.dryRun) {
      return {
        userId: customer.userId,
        userEmail: customer.userEmail,
        emailSent: true,
        telegramNotified: true,
        timestamp: nowStr,
        healthScore: customer.totalHealthScore,
      };
    }

    // Write in-flight reservation record to admin_audit_log BEFORE async network I/O
    // This closes the TOCTOU window across concurrent workers/requests
    await recordWinBackOutreach(customer.userId, {
      status: 'in_flight',
      healthScore: customer.totalHealthScore,
      dispatchedAt: nowStr,
    });

    let emailSent = false;
    let telegramNotified = false;

    // 1. Send targeted bilingual win-back email via Resend
    try {
      const greetingName = escapeHtml(customer.userName || customer.userEmail.split('@')[0]);
      const emailResult = await sendEmail({
        to: customer.userEmail,
        subject: 'Sophia AI: We miss you! / Chúng tôi có thể hỗ trợ gì cho bạn?',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #18181b;">
            <h2 style="color: #0f172a; margin-bottom: 16px;">We noticed you have been away / Chúng tôi nhận thấy bạn đã vắng mặt</h2>
            <p style="font-size: 15px; line-height: 1.6; color: #3f3f46;">
              Xin chào <strong>${greetingName}</strong>,<br/><br/>
              Hệ thống Sophia AI nhận thấy chiến dịch tạo video tự động của bạn đang tạm lắng trong vài ngày qua. 
              Đội ngũ Sophia luôn sẵn sàng hỗ trợ bạn tối ưu kịch bản viral, kết nối kênh mạng xã hội, hoặc giải quyết bất kỳ vướng mắc kỹ thuật nào.
            </p>
            <div style="background-color: #f4f4f5; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #52525b;">
                💡 <strong>Mẹo nhỏ hôm nay:</strong> Chỉ cần chọn mẫu kịch bản "Bán hàng E-Commerce" và bấm Tạo Video, Trợ lý AI sẽ tự động phân phối lên TikTok & Reels cho bạn trong 3 phút.
              </p>
            </div>
            <p style="text-align: center; margin: 30px 0;">
              <a href="https://sophia.agencyos.network/dashboard" style="background-color: #059669; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">
                Quay lại Bảng điều khiển / Return to Dashboard
              </a>
            </p>
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
            <p style="font-size: 12px; color: #a1a1aa; line-height: 1.5;">
              Sophia AI Factory • Autonomous Video Generation & Growth Engine<br/>
              Nếu bạn cần hỗ trợ trực tiếp từ Founder, chỉ cần phản hồi lại email này.
            </p>
          </div>
        `,
      });
      emailSent = emailResult.success;
    } catch (err) {
      logger.warn('[CustomerRetentionService] win-back email dispatch failed', { userId: customer.userId, err: String(err) });
    }

    // 2. Send Telegram alert to founder
    try {
      const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_FOUNDER_CHAT_ID;
      if (adminChatId) {
        const escapedName = escapeTelegramMarkdown(customer.userName || 'Unknown');
        const alertText = 
          `🚨 *[ANTI-CHURN GUARDIAN]* Nguy cơ khách hàng rời bỏ cao!\n\n` +
          `👤 Khách hàng: *${escapedName}* (\`${customer.userEmail}\`)\n` +
          `🆔 User ID: \`${customer.userId}\`\n` +
          `📉 Điểm Sức khỏe: *${customer.totalHealthScore}/100* (CRITICAL CHURN RISK)\n\n` +
          `📊 *Chi tiết 4 chỉ số:*\n` +
          `• Tần suất đăng nhập (Recency): *${customer.recencyScore}/25* (${customer.rawMetrics.daysSinceLastActive} ngày trước)\n` +
          `• Sản lượng video (Velocity): *${customer.velocityScore}/25* (${customer.rawMetrics.videosCreated30d} video/30 ngày)\n` +
          `• Số dư MCU (Capacity): *${customer.capacityScore}/25* (${customer.rawMetrics.creditsRemaining} MCU)\n` +
          `• Độ tin cậy render (Reliability): *${customer.reliabilityScore}/25* (${Math.round(customer.rawMetrics.renderSuccessRate * 100)}% thành công)\n\n` +
          `⚡ Đã tự động gửi email kích hoạt lại. Bấm vào Bảng điều khiển để can thiệp 1-Click: https://sophia.agencyos.network/admin/growth-analytics`;

        const tgResult = await sendTelegramMessage(adminChatId, alertText);
        telegramNotified = !!tgResult;
      }
    } catch (err) {
      logger.warn('[CustomerRetentionService] win-back telegram alert failed', { userId: customer.userId, err: String(err) });
    }

    // 3. Record completion status in audit log
    await recordWinBackOutreach(customer.userId, {
      status: 'completed',
      healthScore: customer.totalHealthScore,
      breakdown: customer.breakdown,
      emailSent,
      telegramNotified,
      dispatchedAt: nowStr,
    });

    return {
      userId: customer.userId,
      userEmail: customer.userEmail,
      emailSent,
      telegramNotified,
      timestamp: nowStr,
      healthScore: customer.totalHealthScore,
    };
  } finally {
    inFlightDispatches.delete(customer.userId);
  }
}

/**
 * Scans all customers, identifies those with health score < 40, and dispatches win-back actions.
 */
export async function scanAndDispatchWinBackTriggers(options?: {
  dryRun?: boolean;
}): Promise<{
  scanned: number;
  atRisk: number;
  dispatched: WinBackTriggerResult[];
}> {
  const customers = await listAllCustomerHealthMetrics({ limit: 100 });
  const dispatched: WinBackTriggerResult[] = [];
  let atRiskCount = 0;

  for (const customer of customers) {
    if (customer.totalHealthScore < CHURN_HEALTH_THRESHOLD) {
      atRiskCount++;
      const result = await dispatchWinBackOutreach(customer, options);
      if (result.emailSent || result.telegramNotified || result.skippedReason === 'COOLDOWN_ACTIVE') {
        dispatched.push(result);
      }
    }
  }

  logger.info('[CustomerRetentionService] Scan complete', {
    scanned: customers.length,
    atRisk: atRiskCount,
    dispatchedCount: dispatched.length,
  });

  return {
    scanned: customers.length,
    atRisk: atRiskCount,
    dispatched,
  };
}

/**
 * 1-Click Founder Intervention:
 * Grants bonus credits and dispatches immediate high-touch founder outreach.
 */
export async function executeFounderIntervention(
  request: FounderInterventionRequest,
): Promise<FounderInterventionResult> {
  const { userId, bonusCredits = 500, customMessage, notifyEmail = true, notifyTelegram = true, actorUserId = 'founder_admin' } = request;
  const nowStr = new Date().toISOString();

  // 1. Fetch user to confirm existence and email
  const customer = await getCustomerHealthMetrics(userId);
  if (!customer) {
    return {
      success: false,
      userId,
      creditsAdded: 0,
      emailSent: false,
      telegramNotified: false,
      message: 'Customer not found',
      timestamp: nowStr,
    };
  }

  // 2. Atomically grant bonus MCU credits
  let creditsAdded = 0;
  if (bonusCredits > 0) {
    const success = await addCredits(
      userId,
      bonusCredits,
      'FOUNDER_WINBACK_BONUS',
      { customMessage, actorUserId, grantedAt: nowStr },
    );
    if (success) {
      creditsAdded = bonusCredits;
    } else {
      logger.error('[CustomerRetentionService] Failed to grant bonus credits', { userId, bonusCredits });
    }
  }

  // 3. Send high-touch Founder Support Email if requested
  let emailSent = false;
  if (notifyEmail && customer.userEmail) {
    try {
      const recipientName = escapeHtml(customer.userName || customer.userEmail.split('@')[0]);
      const escapedNote = customMessage ? escapeHtml(customMessage) : '';
      const noteContent = escapedNote
        ? `<div style="background-color: #ecfdf5; border-left: 4px solid #059669; padding: 14px; margin: 16px 0; font-style: italic; color: #065f46;">"${escapedNote}"</div>`
        : '';

      const emailRes = await sendEmail({
        to: customer.userEmail,
        subject: 'Special Gift from Sophia AI Founder / Quà tặng đặc biệt từ Founder Sophia AI',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #18181b;">
            <h2 style="color: #059669; margin-bottom: 16px;">🎁 Founder Care Gift: +${creditsAdded} MCU Added to Your Account</h2>
            <p style="font-size: 15px; line-height: 1.6; color: #3f3f46;">
              Xin chào <strong>${recipientName}</strong>,<br/><br/>
              Tôi là Founder của Sophia AI Factory. Nhận thấy bạn có thể đang gặp trở ngại trong việc tối ưu hóa nội dung video, tôi đã trực tiếp nạp thêm <strong>${creditsAdded} Model Compute Units (MCU)</strong> hoàn toàn miễn phí vào tài khoản của bạn để bạn thoải mái trải nghiệm.
            </p>
            ${noteContent}
            <p style="text-align: center; margin: 30px 0;">
              <a href="https://sophia.agencyos.network/dashboard" style="background-color: #059669; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">
                Trải nghiệm ngay / Launch Sophia Factory
              </a>
            </p>
            <p style="font-size: 13px; color: #71717a;">
              Nếu bạn muốn đặt lịch 15 phút cùng tôi để cấu hình quy trình sản xuất video tự động riêng cho thương hiệu của bạn, chỉ cần phản hồi trực tiếp email này.
            </p>
          </div>
        `,
      });
      emailSent = emailRes.success;
    } catch (err) {
      logger.warn('[CustomerRetentionService] Founder intervention email error', { userId, err: String(err) });
    }
  }

  // 4. Send confirmation alert to Founder Telegram
  let telegramNotified = false;
  if (notifyTelegram) {
    try {
      const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_FOUNDER_CHAT_ID;
      if (adminChatId) {
        const escapedTgNote = customMessage ? escapeTelegramMarkdown(customMessage) : 'Standard founder care gift';
        const escapedTgName = escapeTelegramMarkdown(customer.userName || customer.userEmail);
        const text = 
          `✅ *[FOUNDER ACTION EXECUTED]* Can thiệp giữ chân khách hàng thành công!\n\n` +
          `👤 Khách hàng: *${escapedTgName}*\n` +
          `🎁 Bonus đã tặng: *+${creditsAdded} MCU*\n` +
          `✉️ Email đã gửi: *${emailSent ? 'Yes' : 'No'}*\n` +
          `📝 Ghi chú: _${escapedTgNote}_\n` +
          `⏱️ Thời gian: ${nowStr}`;

        const tgRes = await sendTelegramMessage(adminChatId, text);
        telegramNotified = !!tgRes;
      }
    } catch (err) {
      logger.warn('[CustomerRetentionService] Founder telegram notification error', { userId, err: String(err) });
    }
  }

  // 5. Record intervention event to admin_audit_log
  let auditLogId: string | undefined;
  try {
    const db = await getD1();
    if (db) {
      auditLogId = crypto.randomUUID();
      await db.prepare(
        `INSERT INTO admin_audit_log (id, actor_user_id, action_type, target_user_id, payload, created_at)
         VALUES (?, ?, 'founder_retention_intervention', ?, ?, strftime('%s','now'))`,
      ).bind(
        auditLogId,
        actorUserId,
        userId,
        JSON.stringify({
          creditsAdded,
          customMessage,
          emailSent,
          telegramNotified,
          executedAt: nowStr,
        }),
      ).run();
    }
  } catch (err) {
    logger.error('[CustomerRetentionService] Recording intervention audit log failed', { userId, err: String(err) });
  }

  // 6. Recalculate health metrics after credit bonus
  const updatedCustomer = await getCustomerHealthMetrics(userId);

  return {
    success: true,
    userId,
    creditsAdded,
    emailSent,
    telegramNotified,
    auditLogId,
    message: `Successfully granted ${creditsAdded} bonus MCU and dispatched intervention`,
    timestamp: nowStr,
    updatedHealthScore: updatedCustomer?.totalHealthScore,
  };
}
