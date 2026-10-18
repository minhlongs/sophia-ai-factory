/**
 * ClickBank INS Webhook Route
 *
 * Receives ClickBank Instant Notification Service (INS) postbacks,
 * verifies HMAC-SHA1 signature, attributes conversion to user campaign,
 * and records commission split in affiliate_conversions.
 *
 * Always returns 200 after signature check to prevent ClickBank retry storms.
 *
 * @module app/api/webhooks/clickbank/route
 */

import { handleClickBankWebhook } from './clickbank-webhook-route-handler';

export async function POST(request: Request): Promise<Response> {
  return handleClickBankWebhook(request);
}
