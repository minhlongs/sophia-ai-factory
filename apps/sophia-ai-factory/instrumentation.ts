export async function register(): Promise<void> {
  // OpenTelemetry SDK requires Node.js builtins (http, fs, zlib, stream, etc.)
  // that are NOT available in Cloudflare Workers, even with nodejs_compat.
  // OTEL initialization must be skipped here. For non-Worker deployments,
  // callers should import and call initializeOTel() from @/seed/telemetry/opentelemetry-setup
  // explicitly at the appropriate entry point.
  //
  // This file exists to satisfy Next.js's instrumentation hook contract.
  // It intentionally does NOT import OTEL to prevent the bundler from
  // including Node.js-dependent OTEL packages in the Worker bundle.
}
