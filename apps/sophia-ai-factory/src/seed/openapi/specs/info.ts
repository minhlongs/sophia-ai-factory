/**
 * OpenAPI Info and Server Configuration
 *
 * Layer: seed/openapi
 */

export const OPENAPI_INFO = {
  title: 'Sophia AI Factory — Public v1 API',
  version: '1.0.0',
  description:
    'Public REST API for the Sophia AI Factory. Customer-facing endpoints for missions, usage metering, and content catalogs. Internal/admin routes are out of scope.',
} as const;

export const OPENAPI_SERVERS = [
  { url: 'https://sophia.agencyos.network', description: 'Production' },
] as const;
