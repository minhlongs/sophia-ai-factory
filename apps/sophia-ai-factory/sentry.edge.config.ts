/**
 * Sentry edge runtime initialization — middleware + edge route handlers.
 * Minimal integrations only (no fs/path, CF Workers edge compatible).
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */
import * as Sentry from '@sentry/nextjs';
import { buildEdgeOptions } from '@/lib/observability/sentry-options';

Sentry.init(buildEdgeOptions());
