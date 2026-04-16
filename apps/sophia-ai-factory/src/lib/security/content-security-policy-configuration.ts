/**
 * Content Security Policy Configuration
 * Strict CSP để chống XSS attacks
 */

export const cspConfig = {
  // Chỉ cho phép scripts từ self và Next.js chunks
  scriptSrc: [
    "'self'",
    "'unsafe-inline'", // Required for Next.js App Router hydration scripts
    ...(process.env.NODE_ENV === 'production'
      ? []
      : ["'unsafe-eval'"]), // Dev mode needs unsafe-eval for HMR
  ],

  // Styles: self + inline (Tailwind requires)
  styleSrc: [
    "'self'",
    "'unsafe-inline'", // Tailwind CSS requires this
    'https://fonts.googleapis.com',
  ],

  // Images: self + HTTPS + data URIs
  imgSrc: [
    "'self'",
    'https:',
    'data:',
    'blob:',
  ],

  // Fonts: self + data URIs
  fontSrc: [
    "'self'",
    'data:',
    'https://fonts.gstatic.com',
  ],

  // API connections: restricted to known domains
  connectSrc: [
    "'self'",
    'https://*.supabase.co',
    // polar.sh removed — Polar rejected this product (2026-03-23)
    'https://api.heygen.com',
    'https://api.openai.com',
    'https://openrouter.ai',
    'https://api.elevenlabs.io',
    'https://api.inngest.com',
    'https://nowpayments.io',
    'https://api.nowpayments.io',
  ],

  // Frames: YouTube only
  frameSrc: [
    "'self'",
    'https://www.youtube.com',
  ],

  // Workers: self only
  workerSrc: ["'self'"],

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
 * Build CSP header string
 */
export function buildCSPHeader(): string {
  const directives = [
    `default-src ${cspConfig.defaultSrc.join(' ')}`,
    `img-src ${cspConfig.imgSrc.join(' ')}`,
    `script-src ${cspConfig.scriptSrc.join(' ')}`,
    `style-src ${cspConfig.styleSrc.join(' ')}`,
    `font-src ${cspConfig.fontSrc.join(' ')}`,
    `connect-src ${cspConfig.connectSrc.join(' ')}`,
    `frame-src ${cspConfig.frameSrc.join(' ')}`,
    `worker-src ${cspConfig.workerSrc.join(' ')}`,
    `frame-ancestors ${cspConfig.frameAncestors.join(' ')}`,
    `base-uri ${cspConfig.baseUri.join(' ')}`,
    `form-action ${cspConfig.formAction.join(' ')}`,
    `object-src ${cspConfig.objectSrc.join(' ')}`,
  ];

  return directives.join('; ');
}
