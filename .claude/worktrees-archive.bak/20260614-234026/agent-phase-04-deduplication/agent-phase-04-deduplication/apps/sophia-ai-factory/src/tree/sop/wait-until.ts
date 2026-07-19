/**
 * Keep async SOP work alive after an API route responds.
 */
export function waitUntilSopWork(work: Promise<unknown>): void {
  import('@opennextjs/cloudflare')
    .then(({ getCloudflareContext }) => getCloudflareContext())
    .then((cfCtx) => {
      const ctx = cfCtx as { ctx?: { waitUntil?: (promise: Promise<unknown>) => void } };
      ctx.ctx?.waitUntil?.(work);
    })
    .catch(() => {
      // Local dev/test has no Cloudflare execution context; work is already running.
    });
}
