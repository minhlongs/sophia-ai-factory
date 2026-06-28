import type { Metadata } from "next";
import React, { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from 'next-intl/server';
import { HealthIndicator } from "@/forest/components/dashboard/health-indicator";
import { MobileNav } from "@/seed/components/ui/mobile-nav";
import { ThemeToggle } from "@/forest/components/theme-toggle";
import { getCurrentUser } from "@/seed/auth/better-auth-session";
import { AgentSidebar } from "@/forest/components/agent-sidebar/agent-sidebar";
import { CmdKPalette } from "@/forest/components/cmd-k/cmd-k-palette";
import { SidebarQuotaWidget } from "@/forest/components/dashboard/sidebar-quota-widget";
import { TrialBanner } from "./components/trial-banner";
import { CommunityCTABanner } from "@/forest/components/community-cta-banner";
import { AffiliateCTABanner } from "@/forest/components/dashboard/affiliate-cta-banner";
import { getD1Raw } from "@/seed/db/client";
import { resolveUserTier } from "@/seed/db/resolve-user-tier";
import { SignOutButton } from "@/seed/auth/sign-out-button";
import { DashboardSidebarNav } from "@/forest/components/dashboard/dashboard-sidebar-nav";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

async function getUserTrialEndsAt(userId: string): Promise<number | null> {
  try {
    const db = await getD1Raw();
    const row = await db
      .prepare(`SELECT trial_ends_at FROM subscriptions WHERE user_id = ?1 LIMIT 1`)
      .bind(userId)
      .first<{ trial_ends_at: number | null }>();
    return row?.trial_ends_at ?? null;
  } catch {
    return null;
  }
}

async function getRedeemedPromoCode(userId: string): Promise<string | null> {
  try {
    const db = await getD1Raw();
    const row = await db
      .prepare(
        `SELECT promo_code FROM promo_code_redemptions
         WHERE user_id = ?1
         ORDER BY redeemed_at DESC
         LIMIT 1`,
      )
      .bind(userId)
      .first<{ promo_code: string }>();
    return row?.promo_code ?? null;
  } catch {
    return null;
  }
}

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'dashboard' });
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect('/login');
  // Parallelize independent per-user lookups — each is an isolated D1 round-trip.
  const [trialEndsAt, userTier, redeemedCode] = currentUser
    ? await Promise.all([
        getUserTrialEndsAt(currentUser.id),
        resolveUserTier(currentUser.id),
        getRedeemedPromoCode(currentUser.id),
      ])
    : [null, null, null];
  // Operator sidebar visibility — accept either Better Auth `role === 'admin'`
  // (legacy/manual elevation) OR `tier === 'MASTER'` (canonical handover signal,
  // e.g. FREE100 redemption). Aligns with middleware-level admin gate which
  // already uses tier=MASTER as the source of truth. See task #35 thread.
  const isAdmin = currentUser?.role === 'admin' || userTier === 'MASTER';
  const isVi = locale.startsWith('vi');
  // eslint-disable-next-line react-hooks/purity
  const nowSec = Math.floor(Date.now() / 1000);
  // Only show trial banner for BASIC tier users within 7 days of trial expiry.
  // MASTER users (e.g. FREE100 redeemers) have trial_ends_at set but should NOT see the banner.
  const sevenDaysFromNow = nowSec + 7 * 86400;
  const showTrialBanner =
    userTier === 'BASIC' &&
    trialEndsAt !== null &&
    trialEndsAt > nowSec &&
    trialEndsAt <= sevenDaysFromNow;

  return (
    <div className="relative min-h-screen flex text-foreground overflow-hidden bg-gradient-to-tr from-[#020817] via-[#080b18] to-[#120a2e] p-0 md:p-1">
      {/* Fixed Ambient Glow Background */}
      <div className="fixed inset-0 -z-50 overflow-hidden pointer-events-none bg-background">
        {/* Cosmic Primary Orb */}
        <div className="absolute top-[-10%] left-[-10%] w-[55%] h-[55%] rounded-full bg-primary/5 blur-[130px] animate-float" />
        {/* Cosmic Secondary Orb */}
        <div className="absolute bottom-[-10%] right-[-10%] w-[55%] h-[55%] rounded-full bg-accent/5 blur-[130px] animate-float-delayed" />
        {/* Grid Overlay */}
        <div className="absolute inset-0 dot-grid-overlay opacity-[0.03]" />
      </div>

      {/* Sidebar */}
      <aside className="w-64 backdrop-blur-xl bg-background/40 border border-border rounded-2xl shadow-2xl hidden md:flex flex-col z-10 my-4 ml-4 mr-2">
        <div className="p-6 border-b border-border">
          <Link href="/" className="flex items-center gap-2 hover:scale-105 active:scale-95 transition-transform duration-200">
            <span className="text-xl font-bold bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)] bg-clip-text text-transparent">
              {t('header.brand')}
            </span>
          </Link>
          {userTier && (
            <span
              className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                userTier === 'MASTER'
                  ? 'bg-gradient-to-r from-violet-500/20 to-cyan-500/20 text-[var(--neon-cyan)] ring-1 ring-[var(--neon-cyan)]/40'
                  : 'bg-muted text-muted-foreground ring-1 ring-border'
              }`}
              aria-label={t('sidebar.tierBadge', { tier: userTier })}
            >
              {userTier}
            </span>
          )}
          {userTier === 'MASTER' && redeemedCode === 'FREE100' && (
            <div
              className="mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30"
              aria-label={isVi ? 'Đã kích hoạt qua mã FREE100, truy cập trọn đời' : 'Activated via FREE100, lifetime access'}
            >
              <span aria-hidden="true">✦</span>
              {isVi ? 'FREE100 · Trọn đời' : 'FREE100 · Lifetime'}
            </div>
          )}
        </div>

        <DashboardSidebarNav isAdmin={isAdmin} isVi={isVi} />

        <div className="p-4 border-t border-border space-y-2">
          <SidebarQuotaWidget />
          {userTier && userTier !== 'MASTER' && (
            <Link
              href="/pricing"
              className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-gradient-to-r from-violet-500 to-cyan-500 text-white rounded-lg hover:scale-[1.02] active:scale-[0.98] hover:shadow-[0_0_15px_rgba(0,240,255,0.3)] transition-all duration-200"
            >
              {t('sidebar.upgradePlan')}
            </Link>
          )}
          <HealthIndicator />
          <SignOutButton
            label={t('sidebar.sign_out')}
            className="flex items-center gap-3 px-4 py-3 text-destructive rounded-lg hover:bg-destructive/10 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 w-full"
          />
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-background/20 backdrop-blur-md border border-border rounded-2xl shadow-xl overflow-hidden mx-4 my-4 md:my-4 md:mr-4 md:ml-2 z-10">
        {/* Trial banner — shown above content when user has active trial */}
        {showTrialBanner && (
          <TrialBanner trialEndsAt={trialEndsAt!} />
        )}

        {/* Community CTA — dismissible, client-side localStorage gate */}
        <CommunityCTABanner />

        {/* Affiliate CTA — surface 70% commission program, dismissible */}
        <AffiliateCTABanner />

        {/* Mobile Header (visible only on small screens) */}
        <header className="bg-background/30 backdrop-blur-xl border border-border rounded-2xl p-4 mx-4 mt-4 shadow-md md:hidden flex items-center justify-between z-10">
          <span className="font-bold text-lg text-foreground">{t('header.title')}</span>
          <div className="hover:scale-105 active:scale-95 transition-transform duration-200">
            <ThemeToggle />
          </div>
        </header>

        <main id="main-content" className="flex-1 p-6 md:p-8 overflow-y-auto pb-20 md:pb-8 z-0">
          {children}
        </main>
      </div>

      {/* Mobile Navigation */}
      <MobileNav />

      {/* Agent Sidebar — right-rail chat (lazy, client-side) */}
      <Suspense fallback={null}>
        <AgentSidebar />
      </Suspense>

      {/* Cmd+K Command Palette — global shortcut */}
      <Suspense fallback={null}>
        <CmdKPalette isAdmin={isAdmin} />
      </Suspense>
    </div>
  );
}
