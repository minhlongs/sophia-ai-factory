import type { NextConfig } from "next";
import type { Configuration } from "webpack";
import path from 'node:path';
import createNextIntlPlugin from 'next-intl/plugin';
import withBundleAnalyzer from '@next/bundle-analyzer';
import withPWAInit from '@ducanh2912/next-pwa';
import { withSentryConfig } from '@sentry/nextjs';
// CSP is now injected per-request by middleware (nonce-based).
// buildCSPHeader import intentionally removed from next.config.ts.

const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

const withAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development' || process.env.SKIP_PWA === '1',
  register: true,
});

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  outputFileTracingRoot: path.resolve(__dirname),
  // Replace @upstash/redis with stub to avoid uncrypto bundling issues on Cloudflare
  // (Redis not used in production on Sophia — features disabled via env)
  webpack: (config: Configuration) => {
    (config.resolve!.alias as Record<string, string>)['@upstash/redis'] = path.resolve(__dirname, 'src/lib/redis-stub.ts');
    return config;
  },
  // M1 16GB workaround: reactCompiler doubles webpack memory pressure. Disable when SKIP_RC=1.
  reactCompiler: process.env.SKIP_RC === '1' ? false : true,
  serverExternalPackages: [
    // Pure client-side libs — traced into server bundle by nft but never
    // executed on the server. Externalizing lets esbuild stub them safely,
    // reducing the workerd module compilation footprint.
    'html2canvas', 'jszip', 'framer-motion',
    'd3', 'd3-*',
    // DB clients incompatible with Cloudflare Workers (no node:fs)
    'better-sqlite3',
    // Better Auth — externalized so esbuild can resolve workerd-conditional
    // sub-path exports (e.g. @better-auth/core/instrumentation) that
    // copyWorkerdPackages never copies into the output node_modules.
    '@better-auth/kysely-adapter',
    '@better-auth/core',
  ],
  // Gated by scripts/deploy-with-sha.sh Step 0.5 (`npm run type-check`).
  // Next's in-build typecheck is redundant once the gate runs — and was the
  // M1 16GB OOM trigger during deploy:full. Removing it from the inner build
  // requires the deploy script to enforce tsc --noEmit BEFORE next build.
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'v5.airtableusercontent.com', // Allow Airtable attachments
      },
      {
        protocol: 'https',
        hostname: '*.r2.dev', // Allow Cloudflare R2 public buckets
      }
    ],
  },
  // Auth aliases — /signup intentionally NOT redirected: [locale]/signup/page.tsx
  // handles it with query-param preservation (affiliate refs, tab=signup).
  // A blanket next.config redirect strips locale AND query params.
  redirects() {
    return [
      // Root redirect to default locale (vi) - REMOVED: causes redirect loop with middleware
      // { source: '/', destination: '/vi', permanent: false },
      { source: '/register', destination: '/login', permanent: false, locale: false },
      { source: '/sign-up', destination: '/login', permanent: false, locale: false },
      { source: '/signin', destination: '/login', permanent: false, locale: false },
      // Settings
      { source: '/settings', destination: '/dashboard/settings', permanent: true },
      { source: '/settings/security', destination: '/settings/security/mfa', permanent: false },
      // Misc
      { source: '/chat', destination: '/dashboard', permanent: false },
      { source: '/templates', destination: '/dashboard/create', permanent: false },
      { source: '/debug', destination: '/dashboard/system-health', permanent: false },
      { source: '/app', destination: '/dashboard', permanent: false },
      // Docs & help
      { source: '/docs', destination: '/guide', permanent: false },
      { source: '/guides', destination: '/guide', permanent: false },
      { source: '/support', destination: '/dashboard/support', permanent: false },
      { source: '/faq', destination: '/guide/faq', permanent: false },
      { source: '/help', destination: '/guide', permanent: false },
      { source: '/guide/getting-started', destination: '/guide', permanent: false },
      // Landing
      { source: '/about', destination: '/', permanent: false },
      { source: '/contact', destination: '/', permanent: false },
      // Locale prefix always present via next-intl localePrefix: 'always'.
    ];
  },
  headers() {
    return [
      // Immutable cache for hashed static assets (CDN Layer 9)
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // CDN cache for public marketing pages (s-maxage=60, stale-while-revalidate=600).
      // Auth-gated routes (/dashboard/*, /auth/*, /onboarding/*, /welcome/*) keep Cloudflare default no-store.
      {
        source: '/(|en|vi)(|/pricing|/guide|/guide/:path*|/blog|/blog/:path*|/privacy|/terms|/status|/affiliate-discovery)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=600',
          },
        ],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-XSS-Protection',
            value: '0'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
          // Content-Security-Policy is set per-request by middleware (nonce-based).
          // Removed from static headers — middleware is the single source of truth.
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          }
        ]
      }
    ];
  },
};

const composedConfig = withPWA(withAnalyzer(withNextIntl(nextConfig)));

// Skip Sentry build-time wrapping when SKIP_SENTRY_BUILD=1 (M1 16GB OOM workaround).
// Runtime SDK still loads via sentry.*.config.ts — error capture unaffected.
// Per sophia-no-tech-doctrine.md, source-map upload is explicitly OPTIONAL — but
// warn loudly when this is set during a production NODE_ENV build so accidental
// silent regression in observability is visible.
if (process.env.NODE_ENV === 'production' && process.env.SKIP_SENTRY_BUILD === '1') {
   
  console.warn('[next.config] SKIP_SENTRY_BUILD=1 in production build — source maps will NOT be uploaded; prod stack traces will be minified.');
}
const finalConfig = process.env.SKIP_SENTRY_BUILD === '1'
  ? composedConfig
  : withSentryConfig(composedConfig, {
  // Sentry build-time options
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Don't print Sentry logs during build (reduce CI noise)
  silent: true,
  // Upload source maps to Sentry then strip from bundle (fail-fast on upload errors)
  sourcemaps: {},
  // Upload wider set of client-side source maps
  widenClientFileUpload: true,
  // Disable telemetry in CI builds; Sentry v8 auto-skips plugin in dev
  telemetry: false,
  // Note: The plugin's default behavior is to throw on upload errors (fail-fast).
  // No explicit `throwOnError` option exists; errors propagate naturally.
});

export default finalConfig;
