import { usageBuffer } from './buffer-store';

/**
 * Register Node.js shutdown hooks so the buffer flushes on graceful exit.
 *
 * IMPORTANT: this function MUST NOT run at module-evaluation time. The
 * Next.js Edge Runtime statically rejects any module that references
 * `process.on(...)` at the top level — even if guarded behind runtime
 * checks — because the analyzer matches on the literal call site rather
 * than reachability. Keeping the hooks inside an opt-in function means
 * the middleware bundle (Edge) can import this module safely; the Node
 * runtime calls this from `instrumentation.ts` under the
 * `NEXT_RUNTIME === 'nodejs'` guard.
 *
 * @edge-runtime-allowed: process.on hooks are gated inside an exported function; only instrumentation.ts (Node-only) invokes it. See incident commit 58c7192b for the original bug.
 */
export function installShutdownHandlers(): void {
  if (
    typeof process === 'undefined' ||
    typeof (process as NodeJS.Process & { on?: unknown }).on !== 'function' ||
    typeof window !== 'undefined'
  ) {
    return;
  }
  const proc = process as NodeJS.Process;
  proc.on('beforeExit', () => {
    usageBuffer.stop();
  });
  proc.on('SIGTERM', () => {
    usageBuffer.stop();
  });
  proc.on('SIGINT', () => {
    usageBuffer.stop();
  });
}
