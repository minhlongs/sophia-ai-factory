/**
 * Minimal type stub for @opennextjs/cloudflare
 * Full types are provided by the package at runtime.
 */
declare module '@opennextjs/cloudflare' {
  interface CloudflareContext {
    env: Record<string, unknown>;
    ctx: Record<string, unknown>;
    cf: Record<string, unknown>;
  }
  function getCloudflareContext(): Promise<CloudflareContext>;
}
