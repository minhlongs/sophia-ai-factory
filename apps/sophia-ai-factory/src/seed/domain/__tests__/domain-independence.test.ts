import { describe, it, expect, beforeEach } from 'vitest';
import {
  PRODUCTION_TECHNICAL_HOSTNAME,
  PRODUCTION_TECHNICAL_ORIGIN,
  PILOT_TECHNICAL_HOSTNAME,
  PILOT_TECHNICAL_ORIGIN,
  getTechnicalRuntimeIdentity,
  getDefaultPublicOrigin,
  isValidExactHostname,
  normalizeExactHostname,
  getStaticAllowedHosts,
  getEffectiveAllowedHosts,
  registerDynamicActiveHosts,
  invalidateDynamicHostCache,
  resetDynamicHostRegistryForTests,
  onAllowedHostsUpdated,
  resolvePublicRequestOrigin,
  enforceAllowedRequestHost,
  getSafeOriginFromRequest,
} from '@/seed/domain';

const PROD_ENV = { NODE_ENV: 'production' } as const;

describe('seed/domain — technical identity & fail-closed host security', () => {
  beforeEach(() => {
    resetDynamicHostRegistryForTests();
  });

  it('derives production and pilot technical identities independent of brand domains', () => {
    const prod = getTechnicalRuntimeIdentity(PROD_ENV);
    expect(prod.workerName).toBe('sophia-ai-factory');
    expect(prod.technicalHostname).toBe(PRODUCTION_TECHNICAL_HOSTNAME);
    expect(prod.technicalOrigin).toBe(PRODUCTION_TECHNICAL_ORIGIN);
    expect(prod.environment).toBe('production');

    const pilot = getTechnicalRuntimeIdentity({
      NODE_ENV: 'production',
      SOPHIA_PILOT_MODE: 'true',
    });
    expect(pilot.workerName).toBe('sophia-ai-factory-pilot');
    expect(pilot.technicalHostname).toBe(PILOT_TECHNICAL_HOSTNAME);
    expect(pilot.technicalOrigin).toBe(PILOT_TECHNICAL_ORIGIN);
    expect(pilot.environment).toBe('pilot');
  });

  it('never falls back to agencyos.network when env URLs are unset or placeholders', () => {
    const origin = getDefaultPublicOrigin(PROD_ENV);
    expect(origin).toBe(PRODUCTION_TECHNICAL_ORIGIN);
    expect(origin).not.toContain('agencyos.network');

    const placeholderOrigin = getDefaultPublicOrigin({
      NODE_ENV: 'production',
      SOPHIA_PILOT_MODE: 'true',
      APP_URL: 'https://REPLACE_WITH_PILOT_HOSTNAME',
    });
    expect(placeholderOrigin).toBe(PILOT_TECHNICAL_ORIGIN);
  });

  it('validates exact RFC-1123 hostnames and rejects wildcards, paths, and CRLF', () => {
    expect(isValidExactHostname('studio.brand.com')).toBe(true);
    expect(isValidExactHostname(PRODUCTION_TECHNICAL_HOSTNAME)).toBe(true);
    expect(isValidExactHostname('*.brand.com')).toBe(false);
    expect(isValidExactHostname('brand.com:443')).toBe(false);
    expect(isValidExactHostname('brand.com/path')).toBe(false);
    expect(isValidExactHostname('evil.com\r\nX-Injected: 1')).toBe(false);
    expect(isValidExactHostname('https://brand.com')).toBe(false);
    expect(normalizeExactHostname('  Studio.Brand.COM ')).toBe('studio.brand.com');
    expect(normalizeExactHostname('brand.com.')).toBe('');
  });

  it('accepts allowlisted technical workers.dev Host header', () => {
    const req = new Request(`https://${PRODUCTION_TECHNICAL_HOSTNAME}/api/health`, {
      headers: { host: PRODUCTION_TECHNICAL_HOSTNAME },
    });
    const res = resolvePublicRequestOrigin(req, PROD_ENV);
    expect(res).not.toBeNull();
    expect(res?.hostname).toBe(PRODUCTION_TECHNICAL_HOSTNAME);
    expect(res?.origin).toBe(PRODUCTION_TECHNICAL_ORIGIN);
    expect(res?.source).toBe('technical');
    expect(enforceAllowedRequestHost(req, PROD_ENV)).toBeNull();
  });

  it('fails closed (HTTP 421) on unknown Host header and unapproved subdomains', () => {
    for (const badHost of [
      'evil.example.com',
      `fake.${PRODUCTION_TECHNICAL_HOSTNAME}`,
      'phish.agencyos.network',
      '*.sophia.agencyos.network',
    ]) {
      const req = new Request(`https://${PRODUCTION_TECHNICAL_HOSTNAME}/login`, {
        headers: { host: badHost },
      });
      const denied = enforceAllowedRequestHost(req, PROD_ENV);
      expect(denied).not.toBeNull();
      expect(denied?.status).toBe(421);
    }
  });

  it('blocks X-Forwarded-Host header poisoning and comma-separated host smuggling', () => {
    const poisoned = new Request(`https://${PRODUCTION_TECHNICAL_HOSTNAME}/api/auth/session`, {
      headers: {
        host: PRODUCTION_TECHNICAL_HOSTNAME,
        'x-forwarded-host': 'attacker.evil.com',
      },
    });
    expect(resolvePublicRequestOrigin(poisoned, PROD_ENV)).toBeNull();
    expect(enforceAllowedRequestHost(poisoned, PROD_ENV)?.status).toBe(421);

    const smuggled = new Request(`https://${PRODUCTION_TECHNICAL_HOSTNAME}/api/auth/session`, {
      headers: {
        host: PRODUCTION_TECHNICAL_HOSTNAME,
        'x-forwarded-host': `${PRODUCTION_TECHNICAL_HOSTNAME}, attacker.evil.com`,
      },
    });
    expect(enforceAllowedRequestHost(smuggled, PROD_ENV)?.status).toBe(421);

    // Mismatch between two different allowlisted hosts MUST also fail closed
    // to prevent CDN cache poisoning and cross-tenant header forgery.
    registerDynamicActiveHosts(['studio.brand-a.io']);
    const crossAllowlistedMismatch = new Request(
      `https://${PRODUCTION_TECHNICAL_HOSTNAME}/blog/feed.xml`,
      {
        headers: {
          host: PRODUCTION_TECHNICAL_HOSTNAME,
          'x-forwarded-host': 'studio.brand-a.io',
        },
      },
    );
    expect(resolvePublicRequestOrigin(crossAllowlistedMismatch, PROD_ENV)).toBeNull();
    expect(enforceAllowedRequestHost(crossAllowlistedMismatch, PROD_ENV)?.status).toBe(421);

    // Matching Host and X-Forwarded-Host on an allowlisted host succeeds
    const matchingHeaders = new Request('https://studio.brand-a.io/blog/feed.xml', {
      headers: {
        host: 'studio.brand-a.io',
        'x-forwarded-host': 'studio.brand-a.io',
      },
    });
    expect(resolvePublicRequestOrigin(matchingHeaders, PROD_ENV)?.hostname).toBe('studio.brand-a.io');
  });

  it('prevents open redirect / origin spoofing in getSafeOriginFromRequest', () => {
    const spoofed = new Request(`https://${PRODUCTION_TECHNICAL_HOSTNAME}/api/welcome/resend`, {
      headers: { host: 'evil.attacker.io' },
    });
    expect(getSafeOriginFromRequest(spoofed, PROD_ENV)).toBe(PRODUCTION_TECHNICAL_ORIGIN);
  });

  it('activates and rolls back dynamic brand domains at runtime and notifies listeners', () => {
    const updates: (readonly string[])[] = [];
    const unsubscribe = onAllowedHostsUpdated((hosts) => updates.push(hosts));

    try {
      const req = new Request('https://studio.newbrand.io/vi/login', {
        headers: { host: 'studio.newbrand.io' },
      });
      expect(enforceAllowedRequestHost(req, PROD_ENV)?.status).toBe(421);

      registerDynamicActiveHosts(['studio.newbrand.io', '*.wildcard-ignored.io']);
      expect(getEffectiveAllowedHosts(PROD_ENV).has('studio.newbrand.io')).toBe(true);
      expect(getEffectiveAllowedHosts(PROD_ENV).has('*.wildcard-ignored.io')).toBe(false);
      expect(updates.length).toBeGreaterThanOrEqual(1);
      expect(enforceAllowedRequestHost(req, PROD_ENV)).toBeNull();

      // Rollback removes dynamic host immediately
      registerDynamicActiveHosts([]);
      expect(enforceAllowedRequestHost(req, PROD_ENV)?.status).toBe(421);
    } finally {
      unsubscribe();
    }
  });

  it('parses ALLOWED_HOSTS env cleanly while discarding invalid entries', () => {
    const hosts = getStaticAllowedHosts({
      NODE_ENV: 'production',
      ALLOWED_HOSTS: 'brand-a.com, *.bad.com, brand.com/path, brand-b.io',
    });
    expect(hosts.has('brand-a.com')).toBe(true);
    expect(hosts.has('brand-b.io')).toBe(true);
    expect(hosts.has(PRODUCTION_TECHNICAL_HOSTNAME)).toBe(true);
    expect(hosts.has('*.bad.com')).toBe(false);
    expect(hosts.has('brand.com/path')).toBe(false);
  });

  it('rejects Host header port injection, leading-zero ports, and invalid TCP ports in production', () => {
    const injectedPort = new Request(`https://${PRODUCTION_TECHNICAL_HOSTNAME}/login`, {
      headers: { host: `${PRODUCTION_TECHNICAL_HOSTNAME}:8443` },
    });
    expect(resolvePublicRequestOrigin(injectedPort, PROD_ENV)).toBeNull();
    expect(enforceAllowedRequestHost(injectedPort, PROD_ENV)?.status).toBe(421);

    const leadingZeroPort = new Request(`https://${PRODUCTION_TECHNICAL_HOSTNAME}/login`, {
      headers: { host: `${PRODUCTION_TECHNICAL_HOSTNAME}:00443` },
    });
    expect(resolvePublicRequestOrigin(leadingZeroPort, PROD_ENV)).toBeNull();

    const outOfRangePort = new Request(`https://${PRODUCTION_TECHNICAL_HOSTNAME}/login`, {
      headers: { host: `${PRODUCTION_TECHNICAL_HOSTNAME}:99999` },
    });
    expect(resolvePublicRequestOrigin(outOfRangePort, PROD_ENV)).toBeNull();

    const stdHttpsPort = new Request(`https://${PRODUCTION_TECHNICAL_HOSTNAME}/login`, {
      headers: { host: `${PRODUCTION_TECHNICAL_HOSTNAME}:443` },
    });
    expect(resolvePublicRequestOrigin(stdHttpsPort, PROD_ENV)?.origin).toBe(
      PRODUCTION_TECHNICAL_ORIGIN,
    );
  });

  it('identifies pilot Worker when PILOT_INVITE_ONLY=true even without SOPHIA_PILOT_MODE', () => {
    const pilot = getTechnicalRuntimeIdentity({
      NODE_ENV: 'production',
      PILOT_INVITE_ONLY: 'true',
    });
    expect(pilot.workerName).toBe('sophia-ai-factory-pilot');
    expect(pilot.technicalHostname).toBe(PILOT_TECHNICAL_HOSTNAME);
    expect(pilot.environment).toBe('pilot');
  });

  it('drops dynamic hosts immediately on cache invalidation or TTL expiry', () => {
    registerDynamicActiveHosts(['ephemeral.brand.io'], 60_000);
    expect(getEffectiveAllowedHosts(PROD_ENV).has('ephemeral.brand.io')).toBe(true);

    invalidateDynamicHostCache();
    expect(getEffectiveAllowedHosts(PROD_ENV).has('ephemeral.brand.io')).toBe(false);

    registerDynamicActiveHosts(['expired.brand.io'], -1);
    expect(getEffectiveAllowedHosts(PROD_ENV).has('expired.brand.io')).toBe(false);
  });
});
