import type { Metadata } from "next";
import React, { Suspense } from "react";
import Link from "next/link";
import { getTranslations } from 'next-intl/server';
import {
  LayoutDashboard,
  PlusCircle,
  Settings,
  Video,
  LogOut,
  BarChart2,
  HelpCircle,
  Code,
  Rocket,
  KeyRound,
  KeySquare,
  FileText,
  GitBranch,
  ShoppingBag,
  Activity,
  Coins,
  Plug,
  Store,
  BookOpen,
  Database,
  FlaskConical,
  Webhook,
  ServerCog,
  Mic,
  LayoutTemplate,
} from "lucide-react";
import { ReplayTourLink } from "./components/replay-tour-link";
import { HealthIndicator } from "@/forest/components/dashboard/health-indicator";
import { MobileNav } from "@/seed/components/ui/mobile-nav";
import { ThemeToggle } from "@/forest/components/theme-toggle";
import { getCurrentUser } from "@/seed/auth/better-auth-session";
import { AgentSidebar } from "@/forest/components/agent-sidebar/agent-sidebar";
import { CmdKPalette } from "@/forest/components/cmd-k/cmd-k-palette";
import { SidebarQuotaWidget } from "@/forest/components/dashboard/sidebar-quota-widget";
import { TrialBanner } from "./components/trial-banner";
import { getD1Raw } from "@/seed/db/client";
import { getUserTier } from "@/seed/db/get-user-tier";
import { SignOutButton } from "@/seed/auth/sign-out-button";

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
  const isAdmin = currentUser?.role === 'admin';
  const trialEndsAt = currentUser ? await getUserTrialEndsAt(currentUser.id) : null;
  const userTier = currentUser ? await getUserTier(currentUser.id) : null;
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
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border hidden md:flex flex-col">
        <div className="p-6 border-b border-border">
          <Link href="/" className="flex items-center gap-2">
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
        </div>

        <nav aria-label="Dashboard sidebar" className="flex-1 p-4 space-y-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="font-medium">{t('sidebar.overview')}</span>
          </Link>
          <Link
            href="/dashboard/create"
            className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <PlusCircle className="w-5 h-5" />
            <span className="font-medium">{t('sidebar.new_project')}</span>
          </Link>
          <Link
            href="/dashboard/campaigns"
            className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="font-medium">{t('sidebar.campaigns')}</span>
          </Link>
          <Link
            href="/dashboard/analytics"
            className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <BarChart2 className="w-5 h-5" />
            <span className="font-medium">{t('sidebar.analytics')}</span>
          </Link>
          <Link
            href="/dashboard/campaigns"
            className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <Video className="w-5 h-5" />
            <span className="font-medium">{t('sidebar.my_videos')}</span>
          </Link>
          <Link
            href="/dashboard/voices"
            className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <Mic className="w-5 h-5" />
            <span className="font-medium">{t('sidebar.voices')}</span>
          </Link>
          <Link
            href="/dashboard/templates"
            className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <LayoutTemplate className="w-5 h-5" />
            <span className="font-medium">{t('sidebar.templates')}</span>
          </Link>
          <Link
            href="/dashboard/orders"
            className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <ShoppingBag className="w-5 h-5" />
            <span className="font-medium">{t('sidebar.orders')}</span>
          </Link>
          <Link
            href="/dashboard/support"
            className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <HelpCircle className="w-5 h-5" />
            <span className="font-medium">{t('sidebar.support')}</span>
          </Link>
          <Link
            href="/dashboard/missions"
            className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <Rocket className="w-5 h-5" />
            <span className="font-medium">{t('sidebar.missions')}</span>
          </Link>
          <Link
            href="/dashboard/credits"
            className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <Coins className="w-5 h-5" />
            <span className="font-medium">{t('sidebar.credits')}</span>
          </Link>
          {/* Integrations section with subnav */}
          <Link
            href="/dashboard/integrations"
            className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <Plug className="w-5 h-5" />
            <span className="font-medium">{t('sidebar.integrations')}</span>
          </Link>
          <Link
            href="/dashboard/integrations/webhooks"
            className="flex items-center gap-3 px-4 py-3 pl-10 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors text-sm"
          >
            <Webhook className="w-4 h-4" />
            <span>{t('sidebar.webhooks')}</span>
            <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">NEW</span>
          </Link>
          <Link
            href="/dashboard/byok"
            className="flex items-center gap-3 px-4 py-3 pl-10 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors text-sm"
          >
            <KeySquare className="w-4 h-4" />
            <span>{t('sidebar.byok')}</span>
          </Link>
          <Link
            href="/dashboard/api-keys"
            className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <KeyRound className="w-5 h-5" />
            <span className="font-medium">{t('sidebar.api_keys')}</span>
          </Link>
          <Link
            href="/dashboard/proposals"
            className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <FileText className="w-5 h-5" />
            <span className="font-medium">{t('sidebar.proposals')}</span>
          </Link>
          <Link
            href="/dashboard/workflows"
            className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <GitBranch className="w-5 h-5" />
            <span className="font-medium">{t('sidebar.workflows')}</span>
          </Link>
          <Link
            href="/dashboard/sop-marketplace"
            className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <Store className="w-5 h-5" />
            <span className="font-medium">{t('sidebar.sop_marketplace')}</span>
          </Link>
          <Link
            href="/dashboard/sops"
            className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <BookOpen className="w-5 h-5" />
            <span className="font-medium">{t('sidebar.my_sops')}</span>
          </Link>
          <Link
            href="/dashboard/api-docs"
            className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <Code className="w-5 h-5" />
            <span className="font-medium">{t('sidebar.api_docs')}</span>
          </Link>
          {isAdmin && (
            <>
              <Link
                href="/dashboard/admin/ops"
                className="flex items-center gap-3 px-4 py-3 text-violet-400 hover:text-violet-300 rounded-lg hover:bg-violet-950/30 transition-colors"
              >
                <Activity className="w-5 h-5" />
                <span className="font-medium">Ops Dashboard</span>
              </Link>
              <Link
                href="/dashboard/admin/funnel"
                className="flex items-center gap-3 px-4 py-3 text-violet-400 hover:text-violet-300 rounded-lg hover:bg-violet-950/30 transition-colors"
              >
                <BarChart2 className="w-5 h-5" />
                <span className="font-medium">Activation Funnel</span>
              </Link>
              <Link
                href="/dashboard/admin/crons"
                className="flex items-center gap-3 px-4 py-3 text-violet-400 hover:text-violet-300 rounded-lg hover:bg-violet-950/30 transition-colors"
              >
                <ServerCog className="w-5 h-5" />
                <span className="font-medium">Cron Monitor</span>
              </Link>
              <Link
                href="/dashboard/admin/email-outbox"
                className="flex items-center gap-3 px-4 py-3 text-violet-400 hover:text-violet-300 rounded-lg hover:bg-violet-950/30 transition-colors"
              >
                <Webhook className="w-5 h-5" />
                <span className="font-medium">Email Outbox</span>
              </Link>
              <Link
                href="/dashboard/admin/affiliate-leaderboard"
                className="flex items-center gap-3 px-4 py-3 text-violet-400 hover:text-violet-300 rounded-lg hover:bg-violet-950/30 transition-colors"
              >
                <Coins className="w-5 h-5" />
                <span className="font-medium">Affiliate Leaderboard</span>
              </Link>
              <Link
                href="/dashboard/admin/webhook-deliveries"
                className="flex items-center gap-3 px-4 py-3 text-violet-400 hover:text-violet-300 rounded-lg hover:bg-violet-950/30 transition-colors"
              >
                <Webhook className="w-5 h-5" />
                <span className="font-medium">Webhook Deliveries</span>
              </Link>
              <Link
                href="/dashboard/admin/storage"
                className="flex items-center gap-3 px-4 py-3 text-violet-400 hover:text-violet-300 rounded-lg hover:bg-violet-950/30 transition-colors"
              >
                <Database className="w-5 h-5" />
                <span className="font-medium">Storage Usage</span>
              </Link>
              <Link
                href="/dashboard/admin/audit-log"
                className="flex items-center gap-3 px-4 py-3 text-violet-400 hover:text-violet-300 rounded-lg hover:bg-violet-950/30 transition-colors"
              >
                <FileText className="w-5 h-5" />
                <span className="font-medium">Audit Log</span>
              </Link>
              <Link
                href="/dashboard/admin/api-key-usage"
                className="flex items-center gap-3 px-4 py-3 text-violet-400 hover:text-violet-300 rounded-lg hover:bg-violet-950/30 transition-colors"
              >
                <KeyRound className="w-5 h-5" />
                <span className="font-medium">API Key Usage</span>
              </Link>
              <Link
                href="/dashboard/admin/migrations"
                className="flex items-center gap-3 px-4 py-3 text-violet-400 hover:text-violet-300 rounded-lg hover:bg-violet-950/30 transition-colors"
              >
                <Database className="w-5 h-5" />
                <span className="font-medium">Migrations</span>
              </Link>
              <Link
                href="/dashboard/admin/e2e-smoke"
                className="flex items-center gap-3 px-4 py-3 text-violet-400 hover:text-violet-300 rounded-lg hover:bg-violet-950/30 transition-colors"
              >
                <FlaskConical className="w-5 h-5" />
                <span className="font-medium">E2E Smoke</span>
              </Link>
              <Link
                href="/dashboard/admin/heygen-webhooks"
                className="flex items-center gap-3 px-4 py-3 text-violet-400 hover:text-violet-300 rounded-lg hover:bg-violet-950/30 transition-colors"
              >
                <Webhook className="w-5 h-5" />
                <span className="font-medium">HeyGen Webhooks</span>
              </Link>
              <Link
                href="/dashboard/admin/deploy-status"
                className="flex items-center gap-3 px-4 py-3 text-violet-400 hover:text-violet-300 rounded-lg hover:bg-violet-950/30 transition-colors"
              >
                <ServerCog className="w-5 h-5" />
                <span className="font-medium">Deploy Status</span>
              </Link>
            </>
          )}
          <Link
            href="/dashboard/account"
            className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <Settings className="w-5 h-5" />
            <span className="font-medium">Account &amp; Billing</span>
          </Link>
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <Settings className="w-5 h-5" />
            <span className="font-medium">{t('sidebar.settings')}</span>
          </Link>
          <ReplayTourLink label={t('sidebar.replay_tour')} />
        </nav>

        <div className="p-4 border-t border-border space-y-2">
          <SidebarQuotaWidget />
          {userTier && userTier !== 'MASTER' && (
            <Link
              href="/pricing"
              className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-violet-500 to-cyan-500 text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              {t('sidebar.upgradePlan')}
            </Link>
          )}
          <HealthIndicator />
          <SignOutButton label={t('sidebar.sign_out')} />
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Trial banner — shown above content when user has active trial */}
        {showTrialBanner && (
          <TrialBanner trialEndsAt={trialEndsAt!} />
        )}

        {/* Mobile Header (visible only on small screens) */}
        <header className="h-16 bg-card border-b border-border md:hidden flex items-center justify-between px-4">
          <span className="font-bold text-lg text-foreground">{t('header.title')}</span>
          <ThemeToggle />
        </header>

        <main id="main-content" className="flex-1 p-6 md:p-8 overflow-y-auto pb-20 md:pb-8">
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
