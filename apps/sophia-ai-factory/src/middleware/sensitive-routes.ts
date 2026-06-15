/**
 * Sensitive routes configuration for middleware
 *
 * Re-exports from config/sensitive-routes for convenient middleware imports.
 * Centralizes knowledge about which routes require additional security checks.
 */

export { SENSITIVE_API_PREFIXES, isSensitiveApiRoute } from '@/config/sensitive-routes';
