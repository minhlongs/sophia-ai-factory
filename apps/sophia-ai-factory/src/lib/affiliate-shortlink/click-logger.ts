/**
 * Click Logger
 *
 * Fire-and-forget D1 insert for affiliate click tracking.
 * Never propagates errors to caller — logs warnings on failure.
 *
 * @module affiliate-shortlink/click-logger
 */

import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import { hashIp, getDailySalt } from './ip-hash';

export interface ClickLogParams {
  clickId: string;
  campaignId: string;
  userId: string;
  offerId: string;
  shortCode: string;
  ip: string | null;
  userAgent: string | null;
  referer: string | null;
  country: string | null;
}

/**
 * Log a click event to D1 affiliate_clicks table.
 * Fire-and-forget — errors are caught and warned, never thrown.
 */
export function logClick(params: ClickLogParams): void {
  // Intentionally not awaited — fire and forget
  void (async () => {
    try {
      const salt = getDailySalt();
      const ipHash = params.ip ? await hashIp(params.ip, salt) : null;

      const db = createServerClient();
      const { error } = await db.from('affiliate_clicks').insert({
        click_id: params.clickId,
        campaign_id: params.campaignId,
        user_id: params.userId,
        offer_id: params.offerId,
        short_code: params.shortCode,
        ip_hash: ipHash,
        user_agent: params.userAgent,
        referer: params.referer,
        country: params.country,
      });

      if (error) {
        logger.warn('affiliate_click_insert_failed', {
          clickId: params.clickId,
          shortCode: params.shortCode,
          error: String(error),
        });
      }
    } catch (err) {
      logger.warn('affiliate_click_logger_error', {
        clickId: params.clickId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  })();
}
