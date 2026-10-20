/**
 * user-agent-bot-detect.ts — Decide whether a click came from a human browser.
 *
 * Click rows store a truncated user agent (never a fingerprint). This module
 * answers one question about it: is this string absent or an automation
 * signature? Kept separate from the scoring rules so the signature list can
 * change without touching the composite.
 *
 * Layer: tree (domain-reusable primitive). Pure — no I/O, no logging.
 *
 * @module tree/affiliates/user-agent-bot-detect
 */

/** Signatures that identify scripted clients rather than browsers. */
const BOT_USER_AGENT_PATTERN = /bot|crawler|spider|curl|wget|python|scrapy|headless|http-client|libwww|java\/|go-http|okhttp/i;

/**
 * Normalise a user agent to a comparable value.
 *
 * Null, undefined and whitespace-only strings all collapse to `''` so that
 * "no header sent" and "sent an empty header" are treated identically — both
 * mean the client is not a real browser.
 */
export function normaliseUserAgent(userAgent: string | null | undefined): string {
  if (typeof userAgent !== 'string') return '';
  return userAgent.trim();
}

/** True when a user agent is missing, empty or matches a known bot signature. */
export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  const normalised = normaliseUserAgent(userAgent);
  if (normalised.length === 0) return true;
  return BOT_USER_AGENT_PATTERN.test(normalised);
}
