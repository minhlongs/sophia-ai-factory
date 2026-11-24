import { describe, it, expect, beforeEach } from 'vitest';
import {
  PRODUCTION_TECHNICAL_HOSTNAME,
  PRODUCTION_TECHNICAL_ORIGIN,
  resetDynamicHostRegistryForTests,
  registerDynamicActiveHosts,
} from '@/seed/domain';
import {
  resolveAllowedAuthHosts,
  resolveTrustedOrigins,
  resolveBaseURL,
} from '@/seed/auth/server/d1-adapter-helpers';
import { handleCorsPrelight } from '@/middleware/cors';

describe('G5 — Better Auth multi-domain & CORS fail-closed checks', () => {
  beforeEach(() => {
    resetDynamicHostRegistryForTests();
  });

  it('resolves Better Auth baseURL to technical workers.dev in production when env URLs are unset', () => {
    const env = process.env as Record<string, string | undefined>;
    const prevNodeEnv = env.NODE_ENV;
    const prevBetter = env.BETTER_AUTH_URL;
    const prevApp = env.APP_URL;
    const prevPub = env.NEXT_PUBLIC_APP_URL;

    env.NODE_ENV = 'production';
    delete env.BETTER_AUTH_URL;
    delete env.APP_URL;
    delete env.NEXT_PUBLIC_APP_URL;

    try {
      expect(resolveBaseURL()).toBe(PRODUCTION_TECHNICAL_ORIGIN);
    } finally {
      if (prevNodeEnv !== undefined) env.NODE_ENV = prevNodeEnv;
      else delete env.NODE_ENV;
      if (prevBetter !== undefined) env.BETTER_AUTH_URL = prevBetter;
      if (prevApp !== undefined) env.APP_URL = prevApp;
      if (prevPub !== undefined) env.NEXT_PUBLIC_APP_URL = prevPub;
    }
  });

  it('includes dynamic D1 brand domains in allowed auth hosts and trusted origins without wildcards', () => {
    registerDynamicActiveHosts(['app.futurebrand.com']);

    const hosts = resolveAllowedAuthHosts();
    expect(hosts).toContain(PRODUCTION_TECHNICAL_HOSTNAME);
    expect(hosts).toContain('app.futurebrand.com');
    expect(hosts.some((h) => h.includes('*'))).toBe(false);

    const origins = resolveTrustedOrigins(PRODUCTION_TECHNICAL_ORIGIN);
    expect(origins).toContain(PRODUCTION_TECHNICAL_ORIGIN);
    expect(origins).toContain('https://app.futurebrand.com');
    expect(origins.some((o) => o === '*' || o.includes('*'))).toBe(false);
  });

  it('rejects wildcard and unapproved origins in middleware CORS preflight', () => {
    const prevCors = process.env.CORS_ALLOWED_ORIGINS;
    try {
      process.env.CORS_ALLOWED_ORIGINS = '*';
      const wildcardRes = handleCorsPrelight('https://evil.com');
      expect(wildcardRes.headers.get('Access-Control-Allow-Origin')).toBeNull();

      process.env.CORS_ALLOWED_ORIGINS = PRODUCTION_TECHNICAL_ORIGIN;
      const evilRes = handleCorsPrelight('https://evil.com');
      expect(evilRes.headers.get('Access-Control-Allow-Origin')).toBeNull();

      const okRes = handleCorsPrelight(PRODUCTION_TECHNICAL_ORIGIN);
      expect(okRes.headers.get('Access-Control-Allow-Origin')).toBe(
        PRODUCTION_TECHNICAL_ORIGIN,
      );
    } finally {
      if (prevCors !== undefined) process.env.CORS_ALLOWED_ORIGINS = prevCors;
      else delete process.env.CORS_ALLOWED_ORIGINS;
    }
  });
});
