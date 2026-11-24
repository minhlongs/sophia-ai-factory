'use client';

/**
 * Minimal, distraction-free Private Beta header shell for `/[locale]/dashboard/first-value`.
 *
 * Replaces the full multi-product `DashboardShell` when `PILOT_INVITE_ONLY=true`
 * so the invited pilot customer sees only First-Value, Privacy, Support, Locale
 * toggle, and Sign Out — zero video/TTS, billing, or auto-publish navigation.
 *
 * @module components/first-value/pilot-workspace-shell
 */

import React, { useState } from 'react';
import { Link } from '@/navigation';
import { authClient } from '@/seed/auth/better-auth-client';

export interface PilotWorkspaceShellProps {
  readonly email: string;
  readonly isVi: boolean;
  readonly children: React.ReactNode;
}

export function PilotWorkspaceShell({
  email,
  isVi,
  children,
}: PilotWorkspaceShellProps) {
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
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-bold tracking-tight text-foreground">
              Sophia AI Factory
            </span>
            <span className="rounded-full bg-primary/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-primary">
              Private Beta
            </span>
          </div>

          <nav className="flex flex-wrap items-center gap-3 text-xs">
            <a
              href="#support-deletion"
              className="text-muted-foreground hover:text-foreground"
            >
              {isVi ? 'Hỗ trợ & Xóa dữ liệu' : 'Support & Deletion'}
            </a>
            <Link
              href="/privacy"
              className="text-muted-foreground hover:text-foreground"
            >
              {isVi ? 'Bảo mật' : 'Privacy'}
            </Link>
            <Link
              href="/terms"
              className="text-muted-foreground hover:text-foreground"
            >
              {isVi ? 'Điều khoản' : 'Terms'}
            </Link>
            <Link
              href="/dashboard/first-value"
              locale={isVi ? 'en' : 'vi'}
              className="rounded-md border border-border bg-background px-2 py-1 font-mono font-medium text-foreground hover:bg-muted"
            >
              {isVi ? 'EN' : 'VI'}
            </Link>
            {email && (
              <span className="hidden font-mono text-muted-foreground sm:inline">
                {email}
              </span>
            )}
            <button
              type="button"
              disabled={signingOut}
              onClick={() => void handleSignOut()}
              className="rounded-md border border-border bg-background px-2.5 py-1 font-medium text-foreground hover:bg-muted disabled:opacity-50"
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
      <div>{children}</div>
    </div>
  );
}
