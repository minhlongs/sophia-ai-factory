/**
 * POST /api/v1/branding/upload — Upload logo, favicon, or social image to R2.
 *
 * @module app/api/v1/branding/upload/route
 */

import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';
import { handleBrandingUpload } from './handler';

export const dynamic = 'force-dynamic';

// File upload — expensive (R2 write). Ceiling: 10/min.
export const POST = withRateLimit(handleBrandingUpload, {
  addHeaders: true,
  config: { intervalMs: 60_000, maxRequests: 10 },
});
