/**
 * B07: honest landing copy, VI/EN parity, real CTA routes, illustrative demo.
 * Source + message assertions only — no browser, no screenshot.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
const en = JSON.parse(readFileSync(resolve(process.cwd(), 'messages/en.json'), 'utf8'));
const vi = JSON.parse(readFileSync(resolve(process.cwd(), 'messages/vi.json'), 'utf8'));
import { buildEntryHref, buildSignupEntryHref } from '@/tree/affiliate/onboarding/entry-params';

const SRC = resolve(process.cwd(), 'src/components/stitch/screens/landing-hero/modular');
const hero = readFileSync(resolve(SRC, 'hero-header.tsx'), 'utf8');
const mockupHeader = readFileSync(resolve(SRC, 'pipeline-mockup-header.tsx'), 'utf8');

describe('landing headline (exact VI/EN copy)', () => {
  it('uses the prescribed operator headline in both locales', () => {
    expect(en.stitch.landing.headline).toBe('One operator. Multiple affiliate campaigns.');
    expect(vi.stitch.landing.headline).toBe('Một người điều hành. Nhiều chiến dịch affiliate.');
  });

  it('explains CEX + SaaS use cases and who controls content, cost and money', () => {
    for (const m of [en, vi]) {
      const text = `${m.stitch.landing.subheading} ${m.stitch.landing.controlNote}`;
      expect(text.length).toBeGreaterThan(120);
      expect(m.stitch.landing.controlNote).toBeTruthy();
      expect(m.stitch.landing.demoNote).toBeTruthy();
    }
    expect(en.stitch.landing.subheading).toContain('CEX');
    expect(en.stitch.landing.subheading).toContain('SaaS');
  });

  it('keeps the required new keys in both locales (VI/EN parity)', () => {
    for (const m of [en, vi]) {
      const l = m.stitch.landing;
      for (const key of ['controlNote', 'demoNote'] as const) {
        expect(l[key].length).toBeGreaterThan(20);
      }
      expect(l.trustBar.controlContent).toBeTruthy();
      expect(l.trustBar.controlCost).toBeTruthy();
      expect(l.cta.startFree).toBeTruthy();
      expect(l.cta.watchDemo).toBeTruthy();
    }
  });
});

describe('landing honesty (no fabricated social proof / LIVE claims)', () => {
  it('hero has no REC badge, avatars, stars, creator counts or L1–L7', () => {
    for (const banned of ['camera-rec', 'LANDING_HERO_AVATARS', 'Star', 'L1–L7', 'Creator ']) {
      expect(hero.includes(banned), banned).toBe(false);
    }
    // The REC decoration must not simply move into another hero subcomponent.
    for (const file of readdirSync(SRC).filter((name) => name.endsWith('.tsx'))) {
      const source = readFileSync(resolve(SRC, file), 'utf8');
      expect(source.includes('camera-rec'), file).toBe(false);
      expect(source.includes('LANDING_HERO_AVATARS'), file).toBe(false);
    }
  });

  it('does not promise free/unlimited usage or guaranteed earnings', () => {
    for (const m of [en, vi]) {
      const copy = JSON.stringify(m.stitch.landing);
      expect(copy.toLowerCase()).not.toContain('start free');
      expect(copy.toLowerCase()).not.toContain('unlimited videos');
      expect(copy.toLowerCase()).not.toContain('guaranteed profit');
    }
  });

  it('labels the preview illustrative and points CTAs at real routes', () => {
    expect(hero).toContain('href="/register"');
    expect(hero).toContain('href="/guide"');
    expect(hero).toContain('demoNote');
    expect(mockupHeader).not.toContain('LIVE DECK');
    expect(mockupHeader).toContain('ILLUSTRATIVE PREVIEW');
    expect(en.stitch.landing.demoNote.toLowerCase()).toContain('illustrative');
  });
});

describe('onboarding deep links', () => {
  it('preserves offerId, locale, returnTo and the selected tier', () => {
    const href = buildSignupEntryHref({
      offerId: 'offer_42',
      locale: 'vi',
      returnTo: '/dashboard/campaigns',
      selectedTier: 'GROWTH',
      tier: 'GROWTH',
      coupon: 'VIP',
      evil: 'javascript:alert(1)',
    });
    expect(href).toContain('/login?');
    expect(href).toContain('offerId=offer_42');
    expect(href).toContain('locale=vi');
    expect(href).toContain('returnTo=%2Fdashboard%2Fcampaigns');
    expect(href).toContain('selectedTier=GROWTH');
    expect(href).toContain('tab=signup');
    expect(href).not.toContain('evil');
    expect(href).not.toContain('javascript');
  });

  it('drops array/unknown values instead of forwarding open redirects', () => {
    const href = buildEntryHref('/register', { offerId: ['a', 'b'], locale: 'en' });
    expect(href).toBe('/register?locale=en');
    expect(buildEntryHref('/register', {})).toBe('/register');
  });
});
