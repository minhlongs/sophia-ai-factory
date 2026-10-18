/**
 * Consistent Browser Fingerprint Generator
 *
 * Generates deterministic browser fingerprints per creator channel
 * to isolate multi-account identities across residential proxies.
 *
 * Layer: tree/affiliate/proxy (Domain Logic)
 * @module tree/affiliate/proxy/fingerprint-generator
 */

import type { BrowserFingerprint } from './anti-detection-types';

const MOBILE_VIEWPORTS = [
  { width: 390, height: 844, dpr: 3 }, // iPhone 14 / 15
  { width: 412, height: 915, dpr: 2.625 }, // Pixel 7
  { width: 393, height: 852, dpr: 3 }, // iPhone 15 Pro
];

/**
 * Generates a consistent, deterministic browser fingerprint per channel.
 */
export function generateConsistentFingerprint(
  seed: string,
  countryCode = 'US',
): BrowserFingerprint {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const positiveHash = Math.abs(hash);
  const vp = MOBILE_VIEWPORTS[positiveHash % MOBILE_VIEWPORTS.length];

  return {
    userAgent: `Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 SophiaCreator/${positiveHash % 100}`,
    viewportWidth: vp.width,
    viewportHeight: vp.height,
    devicePixelRatio: vp.dpr,
    platform: 'iPhone',
    canvasNoiseSeed: positiveHash % 999983,
    webglVendor: 'Apple Inc. (Apple GPU)',
    locale: countryCode.toLowerCase() === 'vn' ? 'vi-VN' : 'en-US',
  };
}
