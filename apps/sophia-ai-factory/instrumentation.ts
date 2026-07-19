/**
 * Next.js instrumentation hook — Sophia AI Factory.
 *
 * Cloudflare Workers do NOT support @opentelemetry/* packages.
 * This file MUST never throw, never reject, and never depend on
 * Node.js builtins at module-evaluation time. Failure makes the
 * ENTIRE Worker return 500 for every request.
 *
 * DEFENSE-IN-DEPTH:
 * 1. Module-eval IIFE (safeEnvCheck) — runs at top-level, zero imports,
 *    sets IS_WORKERS_RUNTIME before Next.js calls register().
 * 2. register() — short-circuits for Workers via pre-resolved promise
 *    (can never throw because no code path executes in Workers mode).
 * 3. Node.js path: dynamic import of OTel wrapped in try/catch; test hook
 *    bypasses dynamic import when set (vitest can't intercept Vite aliases).
 */

// Debug logging for diagnosing Workers crash — uses console in dev, no-op in prod.
// CRITICAL: must be at top-level (before instrument.ts chunk is evaluated by Turbopack).
const _debugLog = (...args: unknown[]) => {
    try {
        if (typeof self !== 'undefined' && !(self as unknown as { disableInstrumentationLog?: boolean }).disableInstrumentationLog) {
            // eslint-disable-next-line no-console
            console.log('[instrumentation][debug]', ...args);
        }
    } catch { /* logging threw — something is very broken */ }
};
_debugLog('TOP-LEVEL EVAL START', typeof globalThis, typeof (globalThis as any).process, typeof (globalThis as any).EdgeRuntime);

/**
 * Module-eval IIFE: zero imports, zero side effects.
 *
 * IMPORTANT: Workers-specific globals (EdgeRuntime, _cf, etc.) are checked
 * FIRST, before process.env. This is because the nodejs_compat compatibility
 * flag in wrangler.toml creates a process shim with env.NEXT_RUNTIME === 'node',
 * which would falsely return "Node.js runtime" if checked first.
 *
 * Example of the bug this ordering prevents:
 *   - On CF Workers with nodejs_compat: process exists, env.NEXT_RUNTIME === 'node'
 *   - Old code checked process FIRST → returned false (wrong!)
 *   - New code checks EdgeRuntime/_cf FIRST → returns true (correct!)
 */
const IS_WORKERS_RUNTIME = (() => {
    _debugLog('IIFE entry');

    // ── Step 1: Workers-specific globals (checked FIRST) ──
    // With nodejs_compat enabled, Workers gets a process shim with
    // env.NEXT_RUNTIME === 'node', which would falsely return false below.
    // Cloudflare Workers always exposes these globals in the runtime.
    try {
        const g = globalThis as Record<string, unknown>;
        if (typeof g._cf !== 'undefined') { _debugLog('detected: _cf in globalThis (CF Workers)'); return true; }
        if ('cf' in g) { _debugLog('detected: cf in globalThis'); return true; }
        if ('FF_DEBUG' in g) { _debugLog('detected: FF_DEBUG in globalThis'); return true; }
        if ('EdgeRuntime' in g) { _debugLog('detected: EdgeRuntime in globalThis'); return true; }
    } catch { /* globalThis access threw */ }

    // ── Step 2: Generic process.env (non-Workers runtimes) ──
    try {
        if (typeof globalThis.process !== 'undefined') {
            const p = globalThis.process;
            if ((p.env as Record<string, string | undefined> | undefined)?.NEXT_RUNTIME === 'node') return false;
            if ((p.env as Record<string, string | undefined> | undefined)?.NEXT_RUNTIME === 'edge') return true;
        }
    } catch { /* process access threw */ }

    return false;
})();
_debugLog('IS_WORKERS_RUNTIME=', IS_WORKERS_RUNTIME);

/**
 * Pre-resolved promise returned in Workers mode.
 * register() returns this directly — no code path can throw.
 */
const WORKERS_RETURN: Promise<void> = (() => Promise.resolve())();

/**
 * Test hook: injected impl bypasses dynamic import (vitest vi.mock()
 * cannot intercept imports resolved through Vite path aliases).
 * Lives at module scope — no OTel dependencies.
 */
let _initializeOTel: (() => Promise<void>) | null = null;

/**
 * Next.js 16 calls this during server preparation. MUST never throw.
 */
export async function register(): Promise<void> {
    if (IS_WORKERS_RUNTIME) return WORKERS_RETURN;

    // Test hook (preferred) — avoids dynamic import in test environment
    if (_initializeOTel) {
        try { await _initializeOTel(); } catch { /* non-fatal */ }
        return;
    }

    // Production Node.js: dynamic import of OTel (safe — Workers path
    // returns above before reaching here).
    // Guard: only attempt dynamic import when registered impl is absent
    // and we are definitely in a Node.js server context.
    if (!_initializeOTel && typeof globalThis.process !== 'undefined') {
        try {
            const mod = await import('@/seed/telemetry/opentelemetry-setup');
            await mod.initializeOTel();
        } catch { /* non-fatal — app must still serve traffic */ }
    }
}

/**
 * Test-only: inject initializeOTel implementation.
 * @internal — NOT part of public API.
 */
export function __setInitializeOTelForTests(impl?: () => Promise<void>): void {
    _initializeOTel = impl ?? null;
}
