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
  disable: process.env.NODE_ENV === 'development',
  register: true,
});

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  outputFileTracingRoot: path.resolve(__dirname),
  reactCompiler: true,
  serverExternalPackages: ['redis', 'ioredis'],
  typescript: {
    // All TS errors resolved — ignoreBuildErrors removed (TIER-2A).
    ignoreBuildErrors: false,
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
  async redirects() {
    return [
      { source: '/signup', destination: '/login', permanent: true },
      { source: '/:locale/signup', destination: '/login', permanent: false },
      { source: '/settings', destination: '/dashboard/settings', permanent: true },
      { source: '/:locale/settings', destination: '/dashboard/settings', permanent: false },
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

export default withSentryConfig(composedConfig, {
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
