/**
 * Content Security Policy Configuration
 * Nonce-based CSP to prevent XSS — replaces 'unsafe-inline' for script-src.
 * Style-src keeps 'unsafe-inline' (required by Tailwind dynamic class generation).
 */

// Crisp.im live-chat widget allow-list. Enabled at build time when
// NEXT_PUBLIC_CRISP_WEBSITE_ID is set, so it inlines cleanly via Next.js env replacement.
const crispEnabled = Boolean(process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID);
const crispScriptHosts = crispEnabled ? ['https://client.crisp.chat'] : [];
const crispConnectHosts = crispEnabled
  ? ['https://client.crisp.chat', 'wss://client.relay.crisp.chat']
  : [];
const crispImgHosts = crispEnabled
  ? ['https://image.crisp.chat', 'https://storage.crisp.chat']
  : [];
const crispStyleHosts = crispEnabled ? ['https://client.crisp.chat'] : [];
const crispFontHosts = crispEnabled ? ['https://client.crisp.chat'] : [];

export const cspConfig = {
  // script-src: base list WITHOUT 'unsafe-inline' — nonce added per-request in middleware
  scriptSrc: [
    "'self'",
    ...(process.env.NODE_ENV === 'production'
      ? []
      : ["'unsafe-eval'"]), // Dev mode HMR requires eval
    ...crispScriptHosts,
  ],

  // Styles: self + inline (Tailwind requires)
  styleSrc: [
    "'self'",
    "'unsafe-inline'", // Tailwind CSS requires this
    'https://fonts.googleapis.com',
    ...crispStyleHosts,
  ],

  // Images: self + HTTPS + data URIs
  imgSrc: [
    "'self'",
    'https:',
    'data:',
    'blob:',
    ...crispImgHosts,
  ],

  // Fonts: self + data URIs
  fontSrc: [
    "'self'",
    'data:',
    'https://fonts.gstatic.com',
    ...crispFontHosts,
  ],

  // API connections: restricted to known domains
  connectSrc: [
    "'self'",
    // supabase.co removed — project migrated to D1 (2026-04-28, go-live audit T4)
    // Supabase exceptions (OAuth callbacks, admin invite) are server-side only, no browser connect needed
    // polar.sh removed — Polar rejected this product (2026-03-23)
    'https://api.heygen.com',
    'https://api.openai.com',
    'https://openrouter.ai',
    'https://api.elevenlabs.io',
    'https://api.inngest.com',
    'https://nowpayments.io',
    'https://api.nowpayments.io',
    ...crispConnectHosts,
  ],

  // Frames: YouTube only
  frameSrc: [
    "'self'",
    'https://www.youtube.com',
  ],

  // Workers: self + blob: (OpenNext worker chunks load from blob URLs)
  workerSrc: ["'self'", 'blob:'],

  // Report-uri: where browsers POST CSP violation reports.
  // /api/csp-report is a public lightweight logger.
  reportUri: ['/api/csp-report'],

  // Frame ancestors: none (clickjacking protection)
  frameAncestors: ["'none'"],

  // Base URI: self only
  baseUri: ["'self'"],

  // Form actions: self only
  formAction: ["'self'", 'https://nowpayments.io'],

  // Object/embed: none
  objectSrc: ["'none'"],

  // Default fallback
  defaultSrc: ["'self'"],
};

/**
 * Build CSP header string.
 *
 * @param nonce - Per-request nonce hex string (32 chars). When provided, it is
 *   added to script-src as `'nonce-{nonce}'` and 'unsafe-inline' is omitted.
 *   When absent (e.g. build-time static headers call), falls back to
 *   'unsafe-inline' so the static header remains functional until middleware
 *   overrides it for HTML responses.
 *
 * NOTE: next.config.ts no longer sets a Content-Security-Policy header.
 *   Middleware owns all CSP injection at runtime. buildCSPHeader() is kept
 *   exported for tests and future static-asset headers if needed.
 */
export function buildCSPHeader(nonce?: string): string {
  const scriptSrcValues = nonce
    ? [...cspConfig.scriptSrc, `'nonce-${nonce}'`]
    : [...cspConfig.scriptSrc, "'unsafe-inline'"];

  const directives = [
    `default-src ${cspConfig.defaultSrc.join(' ')}`,
    `img-src ${cspConfig.imgSrc.join(' ')}`,
    `script-src ${scriptSrcValues.join(' ')}`,
    `style-src ${cspConfig.styleSrc.join(' ')}`,
    `font-src ${cspConfig.fontSrc.join(' ')}`,
    `connect-src ${cspConfig.connectSrc.join(' ')}`,
    `frame-src ${cspConfig.frameSrc.join(' ')}`,
    `worker-src ${cspConfig.workerSrc.join(' ')}`,
    `frame-ancestors ${cspConfig.frameAncestors.join(' ')}`,
    `base-uri ${cspConfig.baseUri.join(' ')}`,
    `form-action ${cspConfig.formAction.join(' ')}`,
    `object-src ${cspConfig.objectSrc.join(' ')}`,
    `upgrade-insecure-requests`,
    `report-uri ${cspConfig.reportUri.join(' ')}`,
  ];

  return directives.join('; ');
}
