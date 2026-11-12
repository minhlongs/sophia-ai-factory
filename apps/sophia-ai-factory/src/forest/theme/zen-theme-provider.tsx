'use client';

/**
 * ZEN DESIGN OS v1.0 — Dual-Theme Runtime Provider
 * Layer: forest (Application shell & theme orchestration)
 *
 * Wraps `next-themes` with Sophia's locked Dual-Theme contract:
 * - Default mode: `dark` (Director's Control Deck)
 * - Optional mode: `light` (Executive Studio Ivory)
 * - Explicit manual selection (`enableSystem={false}`) so first-time Founders
 *   always land on the signature Director's Control Deck unless they switch.
 */

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

export interface ZenThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: 'dark' | 'light';
  /**
   * Per-request CSP nonce forwarded to `next-themes`' pre-hydration inline
   * script. Middleware sets `script-src 'nonce-{nonce}'` without
   * `'unsafe-inline'`, so an un-nonced theme-restore script is blocked and a
   * light-mode user flashes the dark default until React hydrates.
   */
  nonce?: string;
}

/**
 * Cloudflare Rocket Loader rewrites every `<script>` tag it sees to
 * `type="text/rocketscript"` (deferring execution to its own bootstrapper)
 * unless the tag carries `data-cfasync="false"`. The `next-themes` restore
 * script is nonce-authorized and must run synchronously before first paint,
 * so it is opted out explicitly. This does not weaken the CSP: `next-themes`
 * spreads `scriptProps` before it applies `nonce`, so the per-request nonce
 * still reaches the script and `script-src` stays nonce-strict.
 */
const ROCKET_LOADER_OPT_OUT = { 'data-cfasync': 'false' } as const;

export function ZenThemeProvider({
  children,
  defaultTheme = 'dark',
  nonce,
}: ZenThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={defaultTheme}
      themes={['dark', 'light']}
      enableSystem={false}
      disableTransitionOnChange
      storageKey="sophia-zen-theme"
      nonce={nonce}
      scriptProps={ROCKET_LOADER_OPT_OUT}
    >
      {children}
    </NextThemesProvider>
  );
}
