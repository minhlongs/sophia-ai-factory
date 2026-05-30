"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/seed/utils/cn";
import {
  LayoutDashboard,
  PlusCircle,
  Settings,
  Video,
  BarChart2,
  HelpCircle,
  Code,
  Rocket,
  KeyRound,
  KeySquare,
  FileText,
  GitBranch,
  ShoppingBag,
  Coins,
  Plug,
  Webhook,
  Store,
  BookOpen,
  Brain,
  TrendingUp,
  Shield,
  Bot,
  Sparkles,
  Share2,
  Activity,
  ServerCog,
  Database,
  FlaskConical,
  Mic,
  LayoutTemplate,
  Target,
} from "lucide-react";
import { ReplayTourLink } from "@/app/[locale]/dashboard/components/replay-tour-link";

interface DashboardSidebarNavProps {
  isAdmin: boolean;
  isVi: boolean;
}

export function DashboardSidebarNav({ isAdmin, isVi }: DashboardSidebarNavProps) {
  const pathname = usePathname();
  const t = useTranslations("dashboard");

  const isActive = (href: string) => {
    const cleanPath = pathname ? pathname.replace(/^\/(en|vi)/, "") || "/" : "/";
    const cleanHref = href.replace(/^\/(en|vi)/, "") || "/";
    
    if (cleanHref === "/dashboard") {
      return cleanPath === "/dashboard";
    }
    return cleanPath.startsWith(cleanHref);
  };

  const linkClass = (href: string) => {
    const active = isActive(href);
    return cn(
      "relative flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 group",
      "hover:translate-x-1.5 hover:scale-[1.02] active:scale-[0.98]",
      active
        ? "text-foreground bg-white/5 font-semibold border border-[var(--neon-cyan)]/30 shadow-[0_0_12px_rgba(0,240,255,0.15)]"
        : "text-muted-foreground hover:text-foreground hover:bg-white/[0.02] border border-transparent"
    );
  };

  const iconClass = (href: string) => {
    const active = isActive(href);
    return cn(
      "w-5 h-5 transition-transform duration-300 group-hover:scale-110",
      active ? "text-[var(--neon-cyan)]" : "text-muted-foreground group-hover:text-foreground"
    );
  };

  const renderActiveIndicator = (href: string) => {
    if (isActive(href)) {
      return (
        <span className="absolute left-0 top-1/4 h-1/2 w-1 rounded-r-full bg-gradient-to-b from-cyan-400 to-violet-500 shadow-[0_0_8px_var(--neon-cyan)]" />
      );
    }
    return null;
  };

  return (
    <nav aria-label="Dashboard sidebar" className="flex-1 p-4 space-y-1 overflow-y-auto">
      <Link href="/dashboard" className={linkClass("/dashboard")}>
        {renderActiveIndicator("/dashboard")}
        <LayoutDashboard className={iconClass("/dashboard")} aria-hidden="true" />
        <span className="font-medium">{t('sidebar.overview')}</span>
      </Link>
      
      <Link href="/dashboard/create" className={linkClass("/dashboard/create")}>
        {renderActiveIndicator("/dashboard/create")}
        <PlusCircle className={iconClass("/dashboard/create")} aria-hidden="true" />
        <span className="font-medium">{t('sidebar.new_project')}</span>
      </Link>
      
      <Link href="/dashboard/campaigns" className={linkClass("/dashboard/campaigns")}>
        {renderActiveIndicator("/dashboard/campaigns")}
        <Video className={iconClass("/dashboard/campaigns")} aria-hidden="true" />
        <span className="font-medium">{t('sidebar.my_videos')}</span>
      </Link>
      
      <Link href="/dashboard/creative-studio" className={linkClass("/dashboard/creative-studio")}>
        {renderActiveIndicator("/dashboard/creative-studio")}
        <Sparkles className={iconClass("/dashboard/creative-studio")} aria-hidden="true" />
        <span className="font-medium">{t('sidebar.creative_studio')}</span>
      </Link>

      <Link href="/dashboard/proposals" className={linkClass("/dashboard/proposals")}>
        {renderActiveIndicator("/dashboard/proposals")}
        <FileText className={iconClass("/dashboard/proposals")} aria-hidden="true" />
        <span className="font-medium">{t('sidebar.proposals')}</span>
      </Link>
      
      <Link href="/dashboard/analytics" className={linkClass("/dashboard/analytics")}>
        {renderActiveIndicator("/dashboard/analytics")}
        <BarChart2 className={iconClass("/dashboard/analytics")} aria-hidden="true" />
        <span className="font-medium">{t('sidebar.analytics')}</span>
      </Link>
      
      <Link href="/dashboard/voices" className={linkClass("/dashboard/voices")}>
        {renderActiveIndicator("/dashboard/voices")}
        <Mic className={iconClass("/dashboard/voices")} aria-hidden="true" />
        <span className="font-medium">{t('sidebar.voices')}</span>
      </Link>
      
      <Link href="/dashboard/templates" className={linkClass("/dashboard/templates")}>
        {renderActiveIndicator("/dashboard/templates")}
        <LayoutTemplate className={iconClass("/dashboard/templates")} aria-hidden="true" />
        <span className="font-medium">{t('sidebar.templates')}</span>
      </Link>
      
      <Link href="/dashboard/orders" className={linkClass("/dashboard/orders")}>
        {renderActiveIndicator("/dashboard/orders")}
        <ShoppingBag className={iconClass("/dashboard/orders")} aria-hidden="true" />
        <span className="font-medium">{t('sidebar.orders')}</span>
      </Link>
      
      <Link href="/dashboard/missions" className={linkClass("/dashboard/missions")}>
        {renderActiveIndicator("/dashboard/missions")}
        <Rocket className={iconClass("/dashboard/missions")} aria-hidden="true" />
        <span className="font-medium">{t('sidebar.missions')}</span>
      </Link>
      
      {/* SOP Automation */}
      <Link href="/dashboard/sop-marketplace" className={linkClass("/dashboard/sop-marketplace")}>
        {renderActiveIndicator("/dashboard/sop-marketplace")}
        <Store className={iconClass("/dashboard/sop-marketplace")} aria-hidden="true" />
        <span className="font-medium">{t('sidebar.sop_marketplace')}</span>
      </Link>
      
      <Link href="/dashboard/sops" className={linkClass("/dashboard/sops")}>
        {renderActiveIndicator("/dashboard/sops")}
        <BookOpen className={iconClass("/dashboard/sops")} aria-hidden="true" />
        <span className="font-medium">{t('sidebar.my_sops')}</span>
      </Link>
      
      {isAdmin && (
        <Link href="/dashboard/sop-creator" className={linkClass("/dashboard/sop-creator")}>
          {renderActiveIndicator("/dashboard/sop-creator")}
          <Sparkles className={iconClass("/dashboard/sop-creator")} aria-hidden="true" />
          <span className="font-medium">{t('sidebar.sop_creator')}</span>
        </Link>
      )}
      
      <Link href="/dashboard/challenges" className={linkClass("/dashboard/challenges")}>
        {renderActiveIndicator("/dashboard/challenges")}
        <Target className={iconClass("/dashboard/challenges")} aria-hidden="true" />
        <span className="font-medium">{t('sidebar.challenges')}</span>
      </Link>
      
      {/* Integrations */}
      <Link href="/dashboard/integrations" className={linkClass("/dashboard/integrations")}>
        {renderActiveIndicator("/dashboard/integrations")}
        <Plug className={iconClass("/dashboard/integrations")} aria-hidden="true" />
        <span className="font-medium">{t('sidebar.integrations')}</span>
      </Link>
      
      <Link href="/dashboard/byok" className={linkClass("/dashboard/byok")}>
        {renderActiveIndicator("/dashboard/byok")}
        <KeySquare className={iconClass("/dashboard/byok")} aria-hidden="true" />
        <span className="font-medium">{t('sidebar.byok')}</span>
      </Link>
      
      <Link href="/dashboard/help" className={linkClass("/dashboard/help")}>
        {renderActiveIndicator("/dashboard/help")}
        <HelpCircle className={iconClass("/dashboard/help")} aria-hidden="true" />
        <span className="font-medium">{t('sidebar.support')}</span>
      </Link>
      
      {/* Admin Links */}
      {isAdmin && (
        <>
          <div className="pt-2 mt-2 border-t border-border/50">
            <Link
              href="/dashboard/admin"
              className={cn(
                "relative flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 group",
                "hover:translate-x-1.5 hover:scale-[1.02] active:scale-[0.98]",
                isActive("/dashboard/admin")
                  ? "text-violet-400 bg-white/5 font-semibold border border-violet-500/30 shadow-[0_0_12px_rgba(139,92,246,0.15)]"
                  : "text-violet-400 hover:text-violet-300 hover:bg-violet-950/30 border border-transparent"
              )}
            >
              {renderActiveIndicator("/dashboard/admin")}
              <LayoutDashboard className={cn(
                "w-5 h-5 transition-transform duration-300 group-hover:scale-110",
                isActive("/dashboard/admin") ? "text-violet-400" : "text-violet-400 group-hover:text-violet-300"
              )} aria-hidden="true" />
              <span className="font-medium">Admin Home</span>
            </Link>
            
            <Link
              href="/dashboard/admin/ops"
              className={cn(
                "relative flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 group",
                "hover:translate-x-1.5 hover:scale-[1.02] active:scale-[0.98]",
                isActive("/dashboard/admin/ops")
                  ? "text-violet-400 bg-white/5 font-semibold border border-violet-500/30 shadow-[0_0_12px_rgba(139,92,246,0.15)]"
                  : "text-violet-400 hover:text-violet-300 hover:bg-violet-950/30 border border-transparent"
              )}
            >
              {renderActiveIndicator("/dashboard/admin/ops")}
              <Activity className={cn(
                "w-5 h-5 transition-transform duration-300 group-hover:scale-110",
                isActive("/dashboard/admin/ops") ? "text-violet-400" : "text-violet-400 group-hover:text-violet-300"
              )} aria-hidden="true" />
              <span className="font-medium">Ops Dashboard</span>
            </Link>
            
            <Link
              href="/dashboard/admin/funnel"
              className={cn(
                "relative flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 group",
                "hover:translate-x-1.5 hover:scale-[1.02] active:scale-[0.98]",
                isActive("/dashboard/admin/funnel")
                  ? "text-violet-400 bg-white/5 font-semibold border border-violet-500/30 shadow-[0_0_12px_rgba(139,92,246,0.15)]"
                  : "text-violet-400 hover:text-violet-300 hover:bg-violet-950/30 border border-transparent"
              )}
            >
              {renderActiveIndicator("/dashboard/admin/funnel")}
              <BarChart2 className={cn(
                "w-5 h-5 transition-transform duration-300 group-hover:scale-110",
                isActive("/dashboard/admin/funnel") ? "text-violet-400" : "text-violet-400 group-hover:text-violet-300"
              )} aria-hidden="true" />
              <span className="font-medium">Activation Funnel</span>
            </Link>
            
            <Link
              href="/dashboard/admin/crons"
              className={cn(
                "relative flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 group",
                "hover:translate-x-1.5 hover:scale-[1.02] active:scale-[0.98]",
                isActive("/dashboard/admin/crons")
                  ? "text-violet-400 bg-white/5 font-semibold border border-violet-500/30 shadow-[0_0_12px_rgba(139,92,246,0.15)]"
                  : "text-violet-400 hover:text-violet-300 hover:bg-violet-950/30 border border-transparent"
              )}
            >
              {renderActiveIndicator("/dashboard/admin/crons")}
              <ServerCog className={cn(
                "w-5 h-5 transition-transform duration-300 group-hover:scale-110",
                isActive("/dashboard/admin/crons") ? "text-violet-400" : "text-violet-400 group-hover:text-violet-300"
              )} aria-hidden="true" />
              <span className="font-medium">Cron Monitor</span>
            </Link>
            
            <Link
              href="/dashboard/admin/email-outbox"
              className={cn(
                "relative flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 group",
                "hover:translate-x-1.5 hover:scale-[1.02] active:scale-[0.98]",
                isActive("/dashboard/admin/email-outbox")
                  ? "text-violet-400 bg-white/5 font-semibold border border-violet-500/30 shadow-[0_0_12px_rgba(139,92,246,0.15)]"
                  : "text-violet-400 hover:text-violet-300 hover:bg-violet-950/30 border border-transparent"
              )}
            >
              {renderActiveIndicator("/dashboard/admin/email-outbox")}
              <Webhook className={cn(
                "w-5 h-5 transition-transform duration-300 group-hover:scale-110",
                isActive("/dashboard/admin/email-outbox") ? "text-violet-400" : "text-violet-400 group-hover:text-violet-300"
              )} aria-hidden="true" />
              <span className="font-medium">Email Outbox</span>
            </Link>
            
            <Link
              href="/dashboard/admin/affiliate-leaderboard"
              className={cn(
                "relative flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 group",
                "hover:translate-x-1.5 hover:scale-[1.02] active:scale-[0.98]",
                isActive("/dashboard/admin/affiliate-leaderboard")
                  ? "text-violet-400 bg-white/5 font-semibold border border-violet-500/30 shadow-[0_0_12px_rgba(139,92,246,0.15)]"
                  : "text-violet-400 hover:text-violet-300 hover:bg-violet-950/30 border border-transparent"
              )}
            >
              {renderActiveIndicator("/dashboard/admin/affiliate-leaderboard")}
              <Coins className={cn(
                "w-5 h-5 transition-transform duration-300 group-hover:scale-110",
                isActive("/dashboard/admin/affiliate-leaderboard") ? "text-violet-400" : "text-violet-400 group-hover:text-violet-300"
              )} aria-hidden="true" />
              <span className="font-medium">Affiliate Leaderboard</span>
            </Link>
            
            <Link
              href="/dashboard/admin/webhook-deliveries"
              className={cn(
                "relative flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 group",
                "hover:translate-x-1.5 hover:scale-[1.02] active:scale-[0.98]",
                isActive("/dashboard/admin/webhook-deliveries")
                  ? "text-violet-400 bg-white/5 font-semibold border border-violet-500/30 shadow-[0_0_12px_rgba(139,92,246,0.15)]"
                  : "text-violet-400 hover:text-violet-300 hover:bg-violet-950/30 border border-transparent"
              )}
            >
              {renderActiveIndicator("/dashboard/admin/webhook-deliveries")}
              <Webhook className={cn(
                "w-5 h-5 transition-transform duration-300 group-hover:scale-110",
                isActive("/dashboard/admin/webhook-deliveries") ? "text-violet-400" : "text-violet-400 group-hover:text-violet-300"
              )} aria-hidden="true" />
              <span className="font-medium">Webhook Deliveries</span>
            </Link>
            
            <Link
              href="/dashboard/admin/storage"
              className={cn(
                "relative flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 group",
                "hover:translate-x-1.5 hover:scale-[1.02] active:scale-[0.98]",
                isActive("/dashboard/admin/storage")
                  ? "text-violet-400 bg-white/5 font-semibold border border-violet-500/30 shadow-[0_0_12px_rgba(139,92,246,0.15)]"
                  : "text-violet-400 hover:text-violet-300 hover:bg-violet-950/30 border border-transparent"
              )}
            >
              {renderActiveIndicator("/dashboard/admin/storage")}
              <Database className={cn(
                "w-5 h-5 transition-transform duration-300 group-hover:scale-110",
                isActive("/dashboard/admin/storage") ? "text-violet-400" : "text-violet-400 group-hover:text-violet-300"
              )} aria-hidden="true" />
              <span className="font-medium">Storage Usage</span>
            </Link>
            
            <Link
              href="/dashboard/admin/audit-log"
              className={cn(
                "relative flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 group",
                "hover:translate-x-1.5 hover:scale-[1.02] active:scale-[0.98]",
                isActive("/dashboard/admin/audit-log")
                  ? "text-violet-400 bg-white/5 font-semibold border border-violet-500/30 shadow-[0_0_12px_rgba(139,92,246,0.15)]"
                  : "text-violet-400 hover:text-violet-300 hover:bg-violet-950/30 border border-transparent"
              )}
            >
              {renderActiveIndicator("/dashboard/admin/audit-log")}
              <FileText className={cn(
                "w-5 h-5 transition-transform duration-300 group-hover:scale-110",
                isActive("/dashboard/admin/audit-log") ? "text-violet-400" : "text-violet-400 group-hover:text-violet-300"
              )} aria-hidden="true" />
              <span className="font-medium">Audit Log</span>
            </Link>
            
            <Link
              href="/dashboard/admin/api-key-usage"
              className={cn(
                "relative flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 group",
                "hover:translate-x-1.5 hover:scale-[1.02] active:scale-[0.98]",
                isActive("/dashboard/admin/api-key-usage")
                  ? "text-violet-400 bg-white/5 font-semibold border border-violet-500/30 shadow-[0_0_12px_rgba(139,92,246,0.15)]"
                  : "text-violet-400 hover:text-violet-300 hover:bg-violet-950/30 border border-transparent"
              )}
            >
              {renderActiveIndicator("/dashboard/admin/api-key-usage")}
              <KeyRound className={cn(
                "w-5 h-5 transition-transform duration-300 group-hover:scale-110",
                isActive("/dashboard/admin/api-key-usage") ? "text-violet-400" : "text-violet-400 group-hover:text-violet-300"
              )} aria-hidden="true" />
              <span className="font-medium">API Key Usage</span>
            </Link>
            
            <Link
              href="/dashboard/admin/tenant-lookup"
              className={cn(
                "relative flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 group",
                "hover:translate-x-1.5 hover:scale-[1.02] active:scale-[0.98]",
                isActive("/dashboard/admin/tenant-lookup")
                  ? "text-violet-400 bg-white/5 font-semibold border border-violet-500/30 shadow-[0_0_12px_rgba(139,92,246,0.15)]"
                  : "text-violet-400 hover:text-violet-300 hover:bg-violet-950/30 border border-transparent"
              )}
            >
              {renderActiveIndicator("/dashboard/admin/tenant-lookup")}
              <Activity className={cn(
                "w-5 h-5 transition-transform duration-300 group-hover:scale-110",
                isActive("/dashboard/admin/tenant-lookup") ? "text-violet-400" : "text-violet-400 group-hover:text-violet-300"
              )} aria-hidden="true" />
              <span className="font-medium">Tenant Lookup</span>
            </Link>
            
            <Link
              href="/dashboard/admin/cost"
              className={cn(
                "relative flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 group",
                "hover:translate-x-1.5 hover:scale-[1.02] active:scale-[0.98]",
                isActive("/dashboard/admin/cost")
                  ? "text-violet-400 bg-white/5 font-semibold border border-violet-500/30 shadow-[0_0_12px_rgba(139,92,246,0.15)]"
                  : "text-violet-400 hover:text-violet-300 hover:bg-violet-950/30 border border-transparent"
              )}
            >
              {renderActiveIndicator("/dashboard/admin/cost")}
              <Coins className={cn(
                "w-5 h-5 transition-transform duration-300 group-hover:scale-110",
                isActive("/dashboard/admin/cost") ? "text-violet-400" : "text-violet-400 group-hover:text-violet-300"
              )} aria-hidden="true" />
              <span className="font-medium">Cost Dashboard</span>
            </Link>
            
            <Link
              href="/dashboard/admin/migrations"
              className={cn(
                "relative flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 group",
                "hover:translate-x-1.5 hover:scale-[1.02] active:scale-[0.98]",
                isActive("/dashboard/admin/migrations")
                  ? "text-violet-400 bg-white/5 font-semibold border border-violet-500/30 shadow-[0_0_12px_rgba(139,92,246,0.15)]"
                  : "text-violet-400 hover:text-violet-300 hover:bg-violet-950/30 border border-transparent"
              )}
            >
              {renderActiveIndicator("/dashboard/admin/migrations")}
              <Database className={cn(
                "w-5 h-5 transition-transform duration-300 group-hover:scale-110",
                isActive("/dashboard/admin/migrations") ? "text-violet-400" : "text-violet-400 group-hover:text-violet-300"
              )} aria-hidden="true" />
              <span className="font-medium">Migrations</span>
            </Link>
            
            <Link
              href="/dashboard/admin/e2e-smoke"
              className={cn(
                "relative flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 group",
                "hover:translate-x-1.5 hover:scale-[1.02] active:scale-[0.98]",
                isActive("/dashboard/admin/e2e-smoke")
                  ? "text-violet-400 bg-white/5 font-semibold border border-violet-500/30 shadow-[0_0_12px_rgba(139,92,246,0.15)]"
                  : "text-violet-400 hover:text-violet-300 hover:bg-violet-950/30 border border-transparent"
              )}
            >
              {renderActiveIndicator("/dashboard/admin/e2e-smoke")}
              <FlaskConical className={cn(
                "w-5 h-5 transition-transform duration-300 group-hover:scale-110",
                isActive("/dashboard/admin/e2e-smoke") ? "text-violet-400" : "text-violet-400 group-hover:text-violet-300"
              )} aria-hidden="true" />
              <span className="font-medium">E2E Smoke</span>
            </Link>
            
            <Link
              href="/dashboard/admin/heygen-webhooks"
              className={cn(
                "relative flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 group",
                "hover:translate-x-1.5 hover:scale-[1.02] active:scale-[0.98]",
                isActive("/dashboard/admin/heygen-webhooks")
                  ? "text-violet-400 bg-white/5 font-semibold border border-violet-500/30 shadow-[0_0_12px_rgba(139,92,246,0.15)]"
                  : "text-violet-400 hover:text-violet-300 hover:bg-violet-950/30 border border-transparent"
              )}
            >
              {renderActiveIndicator("/dashboard/admin/heygen-webhooks")}
              <Webhook className={cn(
                "w-5 h-5 transition-transform duration-300 group-hover:scale-110",
                isActive("/dashboard/admin/heygen-webhooks") ? "text-violet-400" : "text-violet-400 group-hover:text-violet-300"
              )} aria-hidden="true" />
              <span className="font-medium">HeyGen Webhooks</span>
            </Link>
            
            <Link
              href="/dashboard/admin/deploy-status"
              className={cn(
                "relative flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 group",
                "hover:translate-x-1.5 hover:scale-[1.02] active:scale-[0.98]",
                isActive("/dashboard/admin/deploy-status")
                  ? "text-violet-400 bg-white/5 font-semibold border border-violet-500/30 shadow-[0_0_12px_rgba(139,92,246,0.15)]"
                  : "text-violet-400 hover:text-violet-300 hover:bg-violet-950/30 border border-transparent"
              )}
            >
              {renderActiveIndicator("/dashboard/admin/deploy-status")}
              <ServerCog className={cn(
                "w-5 h-5 transition-transform duration-300 group-hover:scale-110",
                isActive("/dashboard/admin/deploy-status") ? "text-violet-400" : "text-violet-400 group-hover:text-violet-300"
              )} aria-hidden="true" />
              <span className="font-medium">Deploy Status</span>
            </Link>
          </div>
        </>
      )}
      
      {/* Account & Settings */}
      <Link href="/dashboard/account" className={linkClass("/dashboard/account")}>
        {renderActiveIndicator("/dashboard/account")}
        <Settings className={iconClass("/dashboard/account")} aria-hidden="true" />
        <span className="font-medium">Account &amp; Billing</span>
      </Link>
      
      <Link href="/dashboard/settings" className={linkClass("/dashboard/settings")}>
        {renderActiveIndicator("/dashboard/settings")}
        <Settings className={iconClass("/dashboard/settings")} aria-hidden="true" />
        <span className="font-medium">{t('sidebar.settings')}</span>
      </Link>
      
      <ReplayTourLink label={t('sidebar.replay_tour')} />
    </nav>
  );
}
