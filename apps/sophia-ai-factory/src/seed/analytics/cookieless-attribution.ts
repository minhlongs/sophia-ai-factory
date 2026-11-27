/**
 * Cookie-Less First-Party Affiliate Attribution & Postback Reconciliation.
 *
 * Clean-room pure-TS engine (MIT/Apache-2.0 patterns from getcoherence/openpartner,
 * inventhq/Gobble, and EliasOlie/edge-webhook-relay):
 * - Zero third-party cookies / zero localStorage: propagates `click_id` via URL macros.
 * - Canonicalizes SubID & UTM parameters deterministically.
 * - Computes multi-touch attribution weights (first_click, last_click, linear, position_40_20_40).
 *
 * Layer: seed/analytics (pure deterministic logic, zero external deps)
 *
 * @module seed/analytics/cookieless-attribution
 */

export type AttributionModel = 'last_click' | 'first_click' | 'linear' | 'position_40_20_40';

export interface TouchpointInput {
  readonly clickId: string;
  readonly channel: string;
  readonly timestampMs: number;
}

export interface AttributionCredit {
  readonly clickId: string;
  readonly channel: string;
  readonly weight: number;
}

export function buildCookielessRedirectUrl(
  destinationUrl: string,
  clickId: string,
  subId?: string,
): string {
  const parsed = new URL(destinationUrl);
  if (parsed.protocol !== 'https:') {
    throw new Error('Only https:// affiliate destinations are permitted');
  }
  const cleanClickId = clickId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  if (!cleanClickId) {
    throw new Error('clickId is required');
  }

  let href = parsed.toString();
  if (href.includes('{click_id}')) {
    href = href.replaceAll('{click_id}', encodeURIComponent(cleanClickId));
  } else {
    parsed.searchParams.set('sophia_cid', cleanClickId);
    href = parsed.toString();
  }

  if (subId) {
    const updated = new URL(href);
    updated.searchParams.set('sub_id', subId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48));
    return updated.toString();
  }
  return href;
}

export function computeMultiTouchAttribution(
  touchpoints: readonly TouchpointInput[],
  model: AttributionModel,
): readonly AttributionCredit[] {
  if (touchpoints.length === 0) return [];
  if (touchpoints.some((t) => !Number.isFinite(t.timestampMs))) {
    throw new Error('All touchpoints must have a finite timestampMs');
  }
  const sorted = [...touchpoints].sort((a, b) => a.timestampMs - b.timestampMs);
  const n = sorted.length;

  if (n === 1) {
    return [{ clickId: sorted[0].clickId, channel: sorted[0].channel, weight: 1 }];
  }
  if (model === 'first_click') {
    return sorted.map((t, i) => ({ clickId: t.clickId, channel: t.channel, weight: i === 0 ? 1 : 0 }));
  }
  if (model === 'last_click') {
    return sorted.map((t, i) => ({ clickId: t.clickId, channel: t.channel, weight: i === n - 1 ? 1 : 0 }));
  }
  if (model === 'linear') {
    const share = Number((1 / n).toFixed(4));
    const lastShare = Number((1 - share * (n - 1)).toFixed(4));
    return sorted.map((t, i) => ({
      clickId: t.clickId,
      channel: t.channel,
      weight: i === n - 1 ? lastShare : share,
    }));
  }

  // position_40_20_40 (U-shaped)
  if (n === 2) {
    return [
      { clickId: sorted[0].clickId, channel: sorted[0].channel, weight: 0.5 },
      { clickId: sorted[1].clickId, channel: sorted[1].channel, weight: 0.5 },
    ];
  }
  const middleCount = n - 2;
  const middleShare = Number((0.2 / middleCount).toFixed(4));
  const lastMiddleShare = Number((0.2 - middleShare * (middleCount - 1)).toFixed(4));
  return sorted.map((t, i) => ({
    clickId: t.clickId,
    channel: t.channel,
    weight: i === 0 || i === n - 1 ? 0.4 : i === n - 2 ? lastMiddleShare : middleShare,
  }));
}
