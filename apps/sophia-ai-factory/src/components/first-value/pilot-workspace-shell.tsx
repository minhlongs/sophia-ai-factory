'use client';

/**
 * Private Beta Workspace Shell with Affiliate Revenue Navigation Sidebar.
 *
 * Exposes ONLY working modules in the Private Beta journey:
 * - Overview (`#overview`)
 * - Affiliate Offers (`#affiliate-offers`)
 * - Campaigns (`#campaigns`)
 * - Content Factory (`#content-factory`)
 * - Revenue Analytics (`#revenue-analytics`)
 * - API Keys (`#api-keys`)
 * - Support (`#support-deletion`)
 *
 * @module components/first-value/pilot-workspace-shell
 */

import React, { useState } from 'react';
import {
  BarChart3,
  FileText,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  Tag,
} from 'lucide-react';
import { Link } from '@/navigation';
import { authClient } from '@/seed/auth/better-auth-client';

export interface PilotWorkspaceShellProps {
  readonly email: string;
  readonly isVi: boolean;
  readonly children: React.ReactNode;
}

const PILOT_SIDEBAR_ITEMS = [
  { id: 'overview', href: '#overview', en: 'Overview', vi: 'Tổng quan', Icon: LayoutDashboard },
  {
    id: 'offers',
    href: '#affiliate-offers',
    en: 'Affiliate Offers',
    vi: 'Affiliate Offers',
    Icon: Tag,
  },
  { id: 'campaigns', href: '#campaigns', en: 'Campaigns', vi: 'Chiến dịch', Icon: Megaphone },
  {
    id: 'content',
    href: '#content-factory',
    en: 'Content Factory',
    vi: 'Xưởng nội dung',
    Icon: FileText,
  },
  {
    id: 'revenue',
    href: '#revenue-analytics',
    en: 'Revenue Analytics',
    vi: 'Doanh thu & Hoa hồng',
    Icon: BarChart3,
  },
  { id: 'keys', href: '#api-keys', en: 'API Keys', vi: 'Khóa API (BYOK)', Icon: KeyRound },
  {
    id: 'support',
    href: '#support-deletion',
    en: 'Support',
    vi: 'Hỗ trợ & Xóa dữ liệu',
    Icon: LifeBuoy,
  },
] as const;

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
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-bold tracking-tight text-foreground">
              Sophia AI Factory
            </span>
            <span className="rounded-full bg-primary/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-primary">
              Private Beta
            </span>
            <span className="hidden rounded-full bg-muted px-2.5 py-0.5 font-mono text-xs font-medium text-muted-foreground sm:inline">
              {isVi ? 'Affiliate Revenue Studio' : 'Affiliate Revenue Studio'}
            </span>
          </div>

          <nav aria-label={isVi ? 'Điều hướng nhanh' : 'Top utility navigation'} className="flex flex-wrap items-center gap-3 text-xs">
            <a
              href="#support-deletion"
              className="text-muted-foreground hover:text-foreground"
            >
              {isVi ? 'Hỗ trợ & Xóa dữ liệu' : 'Support & Deletion'}
            </a>
            <Link href="/privacy" className="text-muted-foreground hover:text-foreground">
              {isVi ? 'Bảo mật' : 'Privacy'}
            </Link>
            <Link href="/terms" className="text-muted-foreground hover:text-foreground">
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
              <span className="hidden font-mono text-muted-foreground sm:inline">{email}</span>
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

        {/* Mobile scrollable navigation bar */}
        <nav
          aria-label={isVi ? 'Điều hướng sản phẩm di động' : 'Mobile studio navigation'}
          className="flex gap-1.5 overflow-x-auto border-t border-border px-4 py-2 lg:hidden"
        >
          {PILOT_SIDEBAR_ITEMS.map(({ id, href, en, vi, Icon }) => (
            <a
              key={id}
              href={href}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted"
            >
              <Icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              <span>{isVi ? vi : en}</span>
            </a>
          ))}
        </nav>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 sm:px-6">
        <aside
          aria-label={isVi ? 'Điều hướng Affiliate Studio' : 'Affiliate Studio Sidebar'}
          className="sticky top-16 hidden h-[calc(100vh-5rem)] w-56 shrink-0 flex-col justify-between py-6 lg:flex"
        >
          <div className="flex flex-col gap-1">
            <div className="mb-2 px-2.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {isVi ? 'Điều hướng Affiliate' : 'Affiliate Studio'}
            </div>
            {PILOT_SIDEBAR_ITEMS.map(({ id, href, en, vi, Icon }) => (
              <a
                key={id}
                href={href}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                <span>{isVi ? vi : en}</span>
              </a>
            ))}
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-3 text-[11px] text-muted-foreground">
            <div className="font-semibold text-foreground">
              {isVi ? 'Phạm vi đang bật' : 'Active Beta Scope'}
            </div>
            <p className="mt-1">
              {isVi
                ? 'Tự động đăng mạng xã hội & cổng thanh toán đang tắt theo hợp đồng an toàn Beta.'
                : 'Auto-publishing & billing checkout are intentionally disabled during Private Beta.'}
            </p>
          </div>
        </aside>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
