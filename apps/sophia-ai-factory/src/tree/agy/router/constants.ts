/** Platform reserved subdomains that cannot be registered or used as agency slugs */
export const RESERVED_PLATFORM_SUBDOMAINS: ReadonlySet<string> = new Set([
  'sophia',
  'api',
  'admin',
  'portal',
  'sub',
  'preview',
  'cname',
  'cdn',
  'workers',
  'pages',
  'app',
  'www',
  'status',
  'docs',
  'staging',
  'mail',
  'auth',
  'billing',
  'assets',
  'static',
  'dashboard',
  'root',
  'login',
  'signup',
  'register',
  'raas',
]);

/** Canonical base domain for AgencyOS */
export const CANONICAL_NETWORK_DOMAIN = 'agencyos.network';
