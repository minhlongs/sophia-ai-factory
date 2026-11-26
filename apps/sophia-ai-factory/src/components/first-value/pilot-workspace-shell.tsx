'use client';

/**
 * Calm Single-Focus R&D Studio Shell (Linear / Vercel Geist 2026 Craft Standard).
 *
 * Eliminates the redundant left sidebar and mobile anchor strip in favor of a
 * centered `max-w-5xl` canvas driven by the single Inline Pipeline Header.
 *
 * @module components/first-value/pilot-workspace-shell
 */

import { useState, type ReactNode } from 'react';
import { Link } from '@/navigation';
import { authClient } from '@/seed/auth/better-auth-client';

export interface PilotWorkspaceShellProps {
  readonly email?: string | null;
  readonly isVi: boolean;
  readonly children: ReactNode;
}

export function PilotWorkspaceShell({ email, isVi, children }: PilotWorkspaceShellProps) {
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await authClient.signOut();
    } finally {
      window.location.href = isVi ? '/vi/login' : '/en/login';
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-semibold tracking-tight text-foreground">
              Sophia AI Factory
            </span>
            <span className="text-border">/</span>
            <span className="text-xs font-medium text-muted-foreground">
              {isVi ? 'R&D Studio • $0 RaaS' : 'Internal R&D • $0 RaaS'}
            </span>
          </div>

          <nav
            aria-label={isVi ? 'Điều hướng nhanh' : 'Top utility navigation'}
            className="flex items-center gap-3 text-xs"
          >
            <Link href="/privacy" className="hidden text-muted-foreground hover:text-foreground sm:inline">
              {isVi ? 'Bảo mật' : 'Privacy'}
            </Link>
            <Link href="/terms" className="hidden text-muted-foreground hover:text-foreground sm:inline">
              {isVi ? 'Điều khoản' : 'Terms'}
            </Link>
            <Link
              href="/dashboard/first-value"
              locale={isVi ? 'en' : 'vi'}
              className="rounded-md border border-border px-2 py-0.5 font-mono text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {isVi ? 'EN' : 'VI'}
            </Link>
            {email && (
              <span className="hidden max-w-[180px] truncate font-mono text-[11px] text-muted-foreground md:inline">
                {email}
              </span>
            )}
            <button
              type="button"
              disabled={signingOut}
              onClick={() => void handleSignOut()}
              className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              {signingOut
                ? isVi
                  ? 'Đang thoát...'
                  : 'Signing out...'
                : isVi
                  ? 'Đăng xuất'
                  : 'Sign out'}
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
