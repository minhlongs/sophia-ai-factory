/** Node-only telemetry entry point. Keep imports out of the Edge instrumentation bundle. */

import { initializeOTel } from '@/seed/telemetry/opentelemetry-setup';

export async function register(): Promise<void> {
  await initializeOTel();
}
