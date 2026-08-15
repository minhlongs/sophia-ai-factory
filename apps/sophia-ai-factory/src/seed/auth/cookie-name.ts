/**
 * Stable Better Auth cookie name and prefix helper.
 *
 * Derives the session cookie prefix from NODE_ENV. Both production and
 * development resolve to the same `better-auth.session_token` base; the
 * `__Secure-` prefix is only added in production. Centralizing these
 * prevents divergent logic between the Better Auth config and any route
 * that needs to read or set the same cookie.
 */

const SESSION_COOKIE_BASE = 'better-auth.session_token';

export function isProductionEnvironment(): boolean {
	return process.env.NODE_ENV !== 'development';
}

export function getSessionCookieName(): string {
	return isProductionEnvironment() ? `__Secure-${SESSION_COOKIE_BASE}` : SESSION_COOKIE_BASE;
}