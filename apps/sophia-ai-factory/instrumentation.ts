/**
 * Next.js 15+ instrumentation hook — conditionally initializes Sentry per runtime.
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
    // Install Node-only shutdown hooks for usage buffer flush.
    // Kept out of module-eval to avoid Edge Runtime static rejection.
    const { installShutdownHandlers } = await import(
      './src/forest/usage-metering/batch-buffer'
    );
    installShutdownHandlers();
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
