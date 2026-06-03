import type { NextConfig } from "next";
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
  // M1 16GB workaround: reactCompiler doubles webpack memory pressure. Disable when SKIP_RC=1.
  reactCompiler: process.env.SKIP_RC === '1' ? false : true,
  serverExternalPackages: ['redis', 'ioredis', '@redis/client'],
  experimental: {
    optimizePackageImports: [
      'better-auth', 'date-fns', 'lucide-react', 'zod',
      'recharts', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-popover', '@radix-ui/react-select', '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip', '@tanstack/react-query',
      'cmdk', 'sonner', 'next-intl', 'kysely',
    ],
  },
  typescript: {
    // Gated by scripts/deploy-with-sha.sh Step 0.5 (`npm run type-check`).
    // Next's in-build typecheck is redundant once the gate runs — and was the
    // M1 16GB OOM trigger during deploy:full. Removing it from the inner build
    // requires the deploy script to enforce tsc --noEmit BEFORE next build.
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
  // Wave 12 G1: zod tree-shaking via optimizePackageImports above.
  // resolve.dedupe is not a valid webpack field — removed (was a no-op).
  // Actual zod savings come from Next.js experimental.optimizePackageImports.
  async redirects() {
    return [
      // Auth aliases — /signup intentionally NOT redirected: [locale]/signup/page.tsx
      // handles it with query-param preservation (affiliate refs, tab=signup).
      // A blanket next.config redirect strips locale AND query params.
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
      { source: '/support', destination: '/dashboard/support', permanent: false },
      { source: '/faq', destination: '/guide/faq', permanent: false },
      { source: '/help', destination: '/guide', permanent: false },
      { source: '/guide/getting-started', destination: '/guide', permanent: false },
      // Landing
      { source: '/about', destination: '/', permanent: false },
      { source: '/contact', destination: '/', permanent: false },
      // Locale — redirect /en to root (default locale is en, served without prefix)
      { source: '/en', destination: '/', permanent: true },
      { source: '/en/:path*', destination: '/:path*', permanent: true },
    ];
  },
  async headers() {
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
  // Keep source maps out of client bundle — upload to Sentry then strip
  sourcemaps: { disable: true },
  // Upload wider set of client-side source maps
  widenClientFileUpload: true,
  // Disable telemetry in CI builds; Sentry v8 auto-skips plugin in dev
  telemetry: false,
});

export default finalConfig;
