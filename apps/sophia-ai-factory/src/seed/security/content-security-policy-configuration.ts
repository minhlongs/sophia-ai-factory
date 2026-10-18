/**
 * Content Security Policy Configuration
 * Nonce-based CSP to prevent XSS — replaces 'unsafe-inline' for script-src.
 * Style-src keeps 'unsafe-inline' (required by Tailwind dynamic class generation).
 */

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
  scriptSrc: [
    "'self'",
    ...(process.env.NODE_ENV === 'production' ? [] : ["'unsafe-eval'"]),
    ...crispScriptHosts,
  ],
  styleSrc: [
    "'self'",
    "'unsafe-inline'",
    'https://fonts.googleapis.com',
    ...crispStyleHosts,
  ],
  imgSrc: ["'self'", 'https:', 'data:', 'blob:', ...crispImgHosts],
  fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com', ...crispFontHosts],
  connectSrc: [
    "'self'",
    'https://api.heygen.com',
    'https://api.openai.com',
    'https://openrouter.ai',
    'https://api.elevenlabs.io',
    'https://api.inngest.com',
    'https://nowpayments.io',
    'https://api.nowpayments.io',
    ...crispConnectHosts,
  ],
  frameSrc: ["'self'", 'https://www.youtube.com'],
  workerSrc: ["'self'", 'blob:'],
  reportUri: ['/api/csp-report'],
  frameAncestors: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'", 'https://nowpayments.io'],
  objectSrc: ["'none'"],
  defaultSrc: ["'self'"],
};

/**
 * Build CSP header string.
 * When `nonce` is provided, adds `'nonce-{nonce}'` to script-src and omits `'unsafe-inline'`.
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
