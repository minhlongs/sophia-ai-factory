/**
 * Resolves any public pathname or slug into its canonical DualReadPagePayload.
 * Layer: tree/aeo
 */

import {
  buildCorePagePayload,
  buildNicheHubPayload,
  buildSingleNichePayload,
  type AeoLocale,
  type DualReadPagePayload,
} from '@/seed/aeo';

export function normalizeAeoLocale(rawLocale?: string | null): AeoLocale {
  return rawLocale === 'en' ? 'en' : 'vi';
}

const NON_NEGOTIABLE_HEADS = new Set([
  'dashboard',
  'admin',
  'api',
  'auth',
  'setup',
  'checkout',
  'onboarding',
  'welcome',
  'redeem',
  'payment-success',
  'login',
  'signup',
  'reset-password',
]);

export function isNonNegotiableAeoPath(rawPath: string): boolean {
  const cleaned = rawPath.replace(/\.md$/i, '').replace(/^\/+|\/+$/g, '');
  const segments = cleaned ? cleaned.split('/') : [];
  const routeSegments =
    segments[0] === 'vi' || segments[0] === 'en' ? segments.slice(1) : segments;
  const head = (routeSegments[0] ?? '').toLowerCase();
  return NON_NEGOTIABLE_HEADS.has(head);
}

export function resolveAeoPayloadFromPath(
  rawPath: string,
  explicitLocale?: string | null,
): DualReadPagePayload {
  const cleaned = rawPath
    .replace(/\.md$/i, '')
    .replace(/^\/+|\/+$/g, '');
  const segments = cleaned ? cleaned.split('/') : [];

  let locale: AeoLocale = normalizeAeoLocale(explicitLocale);
  let routeSegments = segments;

  if (segments[0] === 'vi' || segments[0] === 'en') {
    locale = segments[0];
    routeSegments = segments.slice(1);
  }

  const head = routeSegments[0] ?? '';
  const second = routeSegments[1] ?? '';

  if (!head || head === 'home') {
    return buildCorePagePayload('home', locale);
  }
  if (head === 'pricing') {
    return buildCorePagePayload('pricing', locale);
  }
  if (head === 'guide' || head === 'blog') {
    return buildCorePagePayload('guide', locale);
  }
  if (head === 'affiliate' || head === 'affiliate-discovery') {
    return buildCorePagePayload('affiliate', locale);
  }
  if (head === 'status') {
    return buildCorePagePayload('status', locale);
  }
  if (head === 'ai-video') {
    if (second) {
      return buildSingleNichePayload(second, locale);
    }
    return buildNicheHubPayload(locale);
  }

  return buildCorePagePayload('home', locale);
}
