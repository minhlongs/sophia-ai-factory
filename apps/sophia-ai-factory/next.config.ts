import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import { NextConfig } from "next";
import path from 'node:path';
import createNextIntlPlugin from 'next-intl/plugin';

// Polyfill-crypto stub path (must be resolved at build time for webpack alias)
const POLYFILL_CRYPTO_STUB = path.resolve(__dirname, 'scripts/stubs/node-polyfill-crypto-stub.ts');
import withPWAInit from '@ducanh2912/next-pwa';
import withBundleAnalyzer from '@next/bundle-analyzer';
// withSentryConfig REMOVED: it imports @sentry/opentelemetry → @opentelemetry/* → Node.js builtins → Workers crash
// Runtime Sentry SDK (sentry.client.config.ts / sentry.server.config.ts) still works without build-time wrapper

const withNextIntl = createNextIntlPlugin('./src/seed/i18n/server-config.ts');
const withAnalyzer = withBundleAnalyzer({ enabled: process.env.ANALYZE === 'true' });
const withPWA = withPWAInit({ dest: 'public', disable: process.env.NODE_ENV === 'development' || process.env.SKIP_PWA === '1', register: true });

const nextConfig: NextConfig = {
// Exclude source maps from SSR bundle (saves ~3-5MB chunk metadata in handler.mjs)
// Without this, Turbopack emits .map files for every SSR chunk that gets merged into handler.mjs.

output: 'standalone',
outputFileTracingRoot: path.resolve(__dirname),

// Stub Node.js-incompatible packages so Turbopack SSR bundler doesn't inline them into handler.mjs
webpack: (config: import("webpack").Configuration) => {
const alias = config.resolve!.alias as Record<string, string>;
alias['@upstash/redis'] = path.resolve(__dirname, 'src/seed/utils/redis-stub.ts');
alias['@sentry/node-core'] = path.resolve(__dirname, 'src/seed/utils/sentry-stub.ts');
alias['@sentry/node'] = path.resolve(__dirname, 'src/seed/utils/sentry-stub.ts');
// @sentry/opentelemetry is the crash root cause — must alias before turbopack SSR bundling
alias['@sentry/opentelemetry'] = path.resolve(__dirname, 'src/seed/utils/sentry-stub.ts');
alias['@apm-js-collab'] = path.resolve(__dirname, 'src/seed/utils/sentry-stub.ts');
// Next.js v15: node-polyfill-crypto → crashes Workers (require('node:crypto').webcrypto)
// Next.js v16: node-environment-extensions/web-crypto → same crash (require('node:crypto'))
// node-crypto.js itself calls bare require('node:crypto') → must alias the builtin too
// All replaced with stub — Workers provides globalThis.crypto natively.
alias['next/dist/server/node-polyfill-crypto'] = POLYFILL_CRYPTO_STUB;
alias['next/dist/server/node-environment-extensions/web-crypto'] = POLYFILL_CRYPTO_STUB;
alias['node:crypto'] = POLYFILL_CRYPTO_STUB;
return config;
},

// Disable React Compiler on M1 16GB (OOM risk) — SKIP_RC=1 to force off
reactCompiler: process.env.SKIP_RC === '1' ? false : true,

// serverExternalPackages – Turbopack honors these natively in Next.js 16+
// Packages listed here stay as require() at runtime and are NOT inlined into handler.mjs.
serverExternalPackages: [
'html2canvas',
'jszip',
'better-sqlite3',
'@sentry/nextjs', '@sentry/core', '@sentry/react',
'firebase', 'firebase-*',
'@prisma/client', 'prisma',
'@upstash/redis', 'upstash', 'uncrypto',
'@better-auth/kysely-adapter',
'@better-auth/core',
'next/dist/server/node-polyfill-crypto',
'next/dist/server/node-environment-extensions/web-crypto',
],

// M1 16GB OOM workaround: delegate typecheck to deploy gate
typescript: { ignoreBuildErrors: true },

images: {
formats: ['image/avif', 'image/webp'],
remotePatterns: [
{ protocol: 'https', hostname: 'v5.airtableusercontent.com' },
{ protocol: 'https', hostname: '*.r2.dev' },
],
},

redirects() {
return [
{ source: '/', destination: '/vi', permanent: false },
{ source: '/register', destination: '/login', permanent: false, locale: false },
{ source: '/sign-up', destination: '/login', permanent: false, locale: false },
{ source: '/signin', destination: '/login', permanent: false, locale: false },
{ source: '/settings', destination: '/dashboard/settings', permanent: true },
{ source: '/settings/security', destination: '/settings/security/mfa', permanent: false },
{ source: '/chat', destination: '/dashboard', permanent: false },
{ source: '/templates', destination: '/dashboard/create', permanent: false },
{ source: '/debug', destination: '/dashboard/system-health', permanent: false },
{ source: '/app', destination: '/dashboard', permanent: false },
{ source: '/docs', destination: '/guide', permanent: false },
{ source: '/guides', destination: '/guide', permanent: false },
{ source: '/support', destination: '/dashboard/support', permanent: false },
{ source: '/faq', destination: '/guide/faq', permanent: false },
{ source: '/help', destination: '/guide', permanent: false },
{ source: '/guide/getting-started', destination: '/guide', permanent: false },
{ source: '/about', destination: '/', permanent: false },
{ source: '/contact', destination: '/', permanent: false },
];
},

headers() {
return [
{ source: '/_next/static/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
{ source: '/static/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
{ source: '/(|en|vi)(|/pricing|/guide|/guide/:path*|/blog|/blog/:path*|/privacy|/terms|/status|/affiliate-discovery)',
headers: [{ key: 'Cache-Control', value: 'public, s-maxage=60, stale-while-revalidate=600' }] },
{
source: '/:path*',
headers: [
{ key: 'X-DNS-Prefetch-Control', value: 'on' },
{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
{ key: 'X-XSS-Protection', value: '0' },
{ key: 'X-Frame-Options', value: 'DENY' },
{ key: 'X-Content-Type-Options', value: 'nosniff' },
{ key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
{ key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
],
},
];
},
};

export default withPWA(withAnalyzer(withNextIntl(nextConfig)));
