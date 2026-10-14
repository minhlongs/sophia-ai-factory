import type { InboundVerifyOptions } from './types';
import { computeHmacHex, timingSafeEqual } from './crypto-utils';

/**
 * Verify an inbound 3rd-party provider webhook signature.
 *
 * Unlike verifyWebhook (which handles our own t=ts,v1=hex format),
 * this function handles raw HMAC signatures from external providers.
 */
export async function verifyInboundWebhook(
  rawBody: string,
  signature: string,
  secret: string,
  opts: InboundVerifyOptions,
): Promise<boolean> {
  try {
    const message = opts.canonicalize ? opts.canonicalize(rawBody) : rawBody;
    const computed = await computeHmacHex(message, secret, opts.algo);
    return timingSafeEqual(computed, signature.toLowerCase());
  } catch {
    return false;
  }
}
