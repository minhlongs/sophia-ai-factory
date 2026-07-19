import React from "react";
import { getCurrentUser } from "@/seed/auth/better-auth-session";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/seed/components/ui/card";
import { Code, Shield, Gauge } from "lucide-react";
import { ApiKeyManager } from "./api-key-manager";

export const metadata = {
  title: "API Documentation | Sophia AI",
  description: "API reference and documentation for Sophia AI integrations",
};

interface Endpoint {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  description: string;
  auth: "yes" | "no" | "bearer" | "session";
  example: string;
}

interface EndpointGroup {
  key: string;
  endpoints: Endpoint[];
}

const ENDPOINT_GROUPS: EndpointGroup[] = [
  {
    key: "section_general",
    endpoints: [
      {
        method: "GET",
        path: "/api/health",
        description: "Health check endpoint — verifies worker is alive",
        auth: "no",
        example: JSON.stringify({ status: "healthy", timestamp: "2026-07-04T00:00:00.000Z", uptime: 12345, environment: "production" }, null, 2),
      },
      {
        method: "GET",
        path: "/api/version",
        description: "Get deployed version info (commit SHA, deploy time, OpenNext version)",
        auth: "no",
        example: JSON.stringify({ shortSha: "a1b2c3d4", deployedAt: "2026-07-04T00:00:00.000Z", opennextVersion: "1.19.9" }, null, 2),
      },
    ],
  },
  {
    key: "section_checkout",
    endpoints: [
      {
        method: "GET",
        path: "/api/checkout?tier=...&period=...&payment=...",
        description: "Create a checkout session and redirect to payment provider (NOWPayments or PayOS). Query params: tier, period (monthly/yearly), payment (nowpayments/payos)",
        auth: "session",
        example: JSON.stringify({ url: "https://nowpayments.io/payment/?iid=..." }, null, 2),
      },
      {
        method: "GET",
        path: "/api/checkout/status?orderId=sophia_...",
        description: "Poll pending order status after checkout. Returns status, tier, period, paymentId, completedAt",
        auth: "no",
        example: JSON.stringify({ status: "completed", tier: "PREMIUM", period: "monthly", paymentId: "np_123", completedAt: "2026-07-04T00:05:00.000Z" }, null, 2),
      },
      {
        method: "GET",
        path: "/api/cron/pending-orders-cleanup",
        description: "Clean up stale pending orders (internal cron). Requires CRON_SECRET header",
        auth: "bearer",
        example: JSON.stringify({ cleaned: 5 }, null, 2),
      },
    ],
  },
  {
    key: "section_webhooks",
    endpoints: [
      {
        method: "POST",
        path: "/api/webhooks/nowpayments",
        description: "NOWPayments IPN webhook — processes payment notifications (HMAC-SHA512 verified)",
        auth: "no",
        example: JSON.stringify({ received: true }, null, 2),
      },
      {
        method: "POST",
        path: "/api/webhooks/nowpayments-payout",
        description: "NOWPayments payout webhook — handles payout status updates",
        auth: "no",
        example: JSON.stringify({ received: true }, null, 2),
      },
      {
        method: "POST",
        path: "/api/webhooks/payos",
        description: "PayOS payment webhook — Vietnam domestic payment gateway",
        auth: "no",
        example: JSON.stringify({ received: true }, null, 2),
      },
      {
        method: "POST",
        path: "/api/webhooks/telegram",
        description: "Telegram bot webhook — handles @Sophia_Bbot commands and messages",
        auth: "no",
        example: JSON.stringify({ ok: true }, null, 2),
      },
      {
        method: "POST",
        path: "/api/webhooks/overage-billing",
        description: "Overage billing webhook — processes usage-based billing events",
        auth: "no",
        example: JSON.stringify({ received: true }, null, 2),
      },
      {
        method: "POST",
        path: "/api/webhooks/heygen",
        description: "HeyGen video render webhook — receives video completion callbacks",
        auth: "no",
        example: JSON.stringify({ received: true }, null, 2),
      },
      {
        method: "POST",
        path: "/api/webhooks/awin",
        description: "Awin affiliate network webhook — processes conversion callbacks",
        auth: "no",
        example: JSON.stringify({ received: true }, null, 2),
      },
      {
        method: "POST",
        path: "/api/webhooks/clickbank",
        description: "ClickBank affiliate webhook — handles transaction notifications",
        auth: "no",
        example: JSON.stringify({ received: true }, null, 2),
      },
      {
        method: "POST",
        path: "/api/webhooks/accesstrade",
        description: "AccessTrade affiliate webhook — processes affiliate event callbacks",
        auth: "no",
        example: JSON.stringify({ received: true }, null, 2),
      },
      {
        method: "POST",
        path: "/api/webhooks/amazon",
        description: "Amazon affiliate webhook — handles Amazon Associates event notifications",
        auth: "no",
        example: JSON.stringify({ received: true }, null, 2),
      },
      {
        method: "POST",
        path: "/api/webhooks/stripe-connect",
        description: "Stripe Connect webhook — manages connected account events",
        auth: "no",
        example: JSON.stringify({ received: true }, null, 2),
      },
      {
        method: "POST",
        path: "/api/webhooks/tiktok-shop",
        description: "TikTok Shop webhook — processes TikTok Shop order notifications",
        auth: "no",
        example: JSON.stringify({ received: true }, null, 2),
      },
      {
        method: "POST",
        path: "/api/webhooks/tiktok-notification",
        description: "TikTok notification webhook — handles TikTok event callbacks",
        auth: "no",
        example: JSON.stringify({ received: true }, null, 2),
      },
      {
        method: "POST",
        path: "/api/webhooks/youtube-notification",
        description: "YouTube notification webhook — processes YouTube PubSubHubbub callbacks",
        auth: "no",
        example: JSON.stringify({ received: true }, null, 2),
      },
    ],
  },
  {
    key: "section_videos",
    endpoints: [
      {
        method: "GET",
        path: "/api/videos",
        description: "List user's videos with pagination. Query: limit (1-100, default 20), offset (default 0)",
        auth: "session",
        example: JSON.stringify({ videos: [ { id: "vid_123", title: "My Video", status: "completed", video_url: "https://...", thumbnail_url: "https://...", duration_sec: 120, created_at: "2026-07-04T00:00:00.000Z" } ] }, null, 2),
      },
      {
        method: "GET",
        path: "/api/videos/[id]",
        description: "Get a single video by ID with full details",
        auth: "session",
        example: JSON.stringify({ id: "vid_123", title: "My Video", status: "completed", video_url: "https://...", thumbnail_url: "https://...", duration_sec: 120, created_at: "2026-07-04T00:00:00.000Z" }, null, 2),
      },
      {
        method: "GET",
        path: "/api/videos/[id]/url",
        description: "Get a temporary signed URL for video playback/streaming",
        auth: "session",
        example: JSON.stringify({ url: "https://...", expiresAt: "2026-07-04T01:00:00.000Z" }, null, 2),
      },
      {
        method: "GET",
        path: "/api/videos/[id]/description-enriched",
        description: "Get AI-enriched video description with SEO metadata",
        auth: "session",
        example: JSON.stringify({ id: "vid_123", enrichedDescription: "...", keywords: ["keyword1", "keyword2"], seoScore: 85 }, null, 2),
      },
      {
        method: "POST",
        path: "/api/videos/generate",
        description: "[DEPRECATED] Legacy video generation endpoint. Use video:create mission instead",
        auth: "session",
        example: JSON.stringify({ error: "Endpoint deprecated.", message: "Use the video:create mission instead.", replacement: "/api/missions", adr: "ADR-0007" }, null, 2),
      },
    ],
  },
  {
    key: "section_agents",
    endpoints: [
      {
        method: "GET",
        path: "/api/agents/list",
        description: "List AI agents for the authenticated user with current status",
        auth: "session",
        example: JSON.stringify({ agents: [ { id: "agent_1", role: "CEO", name: "Agent Alpha", status: "idle", currentTask: null, lastActiveAt: "2026-07-04T00:00:00.000Z" } ] }, null, 2),
      },
      {
        method: "POST",
        path: "/api/agents/task",
        description: "Create and run a new agent task. Body: { agentId?, input, role? }",
        auth: "session",
        example: JSON.stringify({ task: { id: "task_123", status: "running", agentId: "agent_1", input: "...", createdAt: "2026-07-04T00:00:00.000Z" } }, null, 2),
      },
      {
        method: "GET",
        path: "/api/agents/status/[id]",
        description: "Get current status of a specific agent task",
        auth: "session",
        example: JSON.stringify({ id: "task_123", status: "completed", result: "...", completedAt: "2026-07-04T00:05:00.000Z" }, null, 2),
      },
      {
        method: "GET",
        path: "/api/agents/stream",
        description: "SSE stream for real-time agent task updates",
        auth: "session",
        example: "data: {\"type\":\"update\",\"status\":\"running\",\"progress\":0.5}\n\n",
      },
      {
        method: "POST",
        path: "/api/agents/pause",
        description: "Pause a running agent task. Body: { taskId }",
        auth: "session",
        example: JSON.stringify({ paused: true, taskId: "task_123" }, null, 2),
      },
      {
        method: "POST",
        path: "/api/agents/feedback",
        description: "Submit feedback for a completed agent task. Body: { taskId, rating, comment? }",
        auth: "session",
        example: JSON.stringify({ received: true }, null, 2),
      },
      {
        method: "POST",
        path: "/api/agents/team/create",
        description: "Create a new agent team. Body: { name, roles[] }",
        auth: "session",
        example: JSON.stringify({ team: { id: "team_123", name: "My Team" } }, null, 2),
      },
      {
        method: "GET",
        path: "/api/agents/team",
        description: "Get the user's current agent team configuration",
        auth: "session",
        example: JSON.stringify({ team: { id: "team_123", name: "My Team", agents: [] } }, null, 2),
      },
      {
        method: "POST",
        path: "/api/agents/team/update",
        description: "Update agent team configuration. Body: { name?, agents[]? }",
        auth: "session",
        example: JSON.stringify({ updated: true }, null, 2),
      },
      {
        method: "POST",
        path: "/api/agents/team/delete",
        description: "Delete an agent team. Body: { teamId }",
        auth: "session",
        example: JSON.stringify({ deleted: true }, null, 2),
      },
    ],
  },
  {
    key: "section_affiliates",
    endpoints: [
      {
        method: "GET",
        path: "/api/affiliate/earnings",
        description: "Get affiliate earnings data with date range filtering",
        auth: "session",
        example: JSON.stringify({ earnings: [ { date: "2026-07-04", amount: 150.50, currency: "USD" } ], total: 150.50 }, null, 2),
      },
      {
        method: "GET",
        path: "/api/affiliate/clicks",
        description: "Get affiliate click statistics",
        auth: "session",
        example: JSON.stringify({ clicks: [ { date: "2026-07-04", count: 42 } ], total: 42 }, null, 2),
      },
      {
        method: "GET",
        path: "/api/affiliate/conversions",
        description: "Get affiliate conversion records",
        auth: "session",
        example: JSON.stringify({ conversions: [ { id: "conv_1", product: "...", commission: 25.00, status: "approved", date: "2026-07-04" } ] }, null, 2),
      },
      {
        method: "GET",
        path: "/api/affiliate/conversions/csv",
        description: "Export conversions as CSV download",
        auth: "session",
        example: "id,product,commission,status,date\nconv_1,...,25.00,approved,2026-07-04\n",
      },
      {
        method: "GET",
        path: "/api/affiliate/payouts",
        description: "Get affiliate payout history",
        auth: "session",
        example: JSON.stringify({ payouts: [ { id: "payout_1", amount: 100.00, method: "paypal", status: "completed", date: "2026-07-04" } ] }, null, 2),
      },
      {
        method: "GET",
        path: "/api/affiliate/payout-method",
        description: "Get the user's configured payout method",
        auth: "session",
        example: JSON.stringify({ method: "paypal", email: "user@example.com" }, null, 2),
      },
      {
        method: "POST",
        path: "/api/affiliate/payout-method",
        description: "Update payout method. Body: { method, email? }",
        auth: "session",
        example: JSON.stringify({ updated: true }, null, 2),
      },
      {
        method: "GET",
        path: "/api/affiliate/promo-assets",
        description: "Get promotional assets for affiliate marketing",
        auth: "session",
        example: JSON.stringify({ assets: [ { id: "asset_1", type: "banner", url: "https://...", width: 728, height: 90 } ] }, null, 2),
      },
      {
        method: "GET",
        path: "/api/affiliate-discovery",
        description: "Discover new affiliate programs and opportunities",
        auth: "session",
        example: JSON.stringify({ opportunities: [ { network: "Awin", program: "Program X", commission: "10%" } ] }, null, 2),
      },
    ],
  },
  {
    key: "section_sops",
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/sops",
        description: "List official SOP templates from the marketplace",
        auth: "session",
        example: JSON.stringify({ templates: [ { slug: "sop-1", name: "Daily Revenue Report", description: "...", category: "analytics" } ] }, null, 2),
      },
      {
        method: "POST",
        path: "/api/v1/sops",
        description: "Install an SOP template by slug. Body: { slug, scheduleCron?, enabled?, configValues? }",
        auth: "session",
        example: JSON.stringify({ installation: { id: "inst_1", slug: "sop-1", enabled: true, webhookSecret: "whsec_..." } }, null, 2),
      },
    ],
  },
  {
    key: "section_account",
    endpoints: [
      {
        method: "GET",
        path: "/api/account",
        description: "Get current user account details",
        auth: "session",
        example: JSON.stringify({ id: "user_123", email: "user@example.com", name: "User Name", tier: "PREMIUM", createdAt: "2026-01-01T00:00:00.000Z" }, null, 2),
      },
      {
        method: "POST",
        path: "/api/account/change-email",
        description: "Request email change. Body: { newEmail }",
        auth: "session",
        example: JSON.stringify({ sent: true, message: "Verification email sent to new address" }, null, 2),
      },
      {
        method: "POST",
        path: "/api/account/change-email/verify",
        description: "Verify email change with token. Body: { token }",
        auth: "session",
        example: JSON.stringify({ verified: true, email: "new@example.com" }, null, 2),
      },
      {
        method: "POST",
        path: "/api/account/export",
        description: "Request GDPR data export of all user data",
        auth: "session",
        example: JSON.stringify({ exportId: "exp_123", status: "processing" }, null, 2),
      },
      {
        method: "POST",
        path: "/api/account/delete/request",
        description: "Request account deletion. Sends confirmation email",
        auth: "session",
        example: JSON.stringify({ sent: true, message: "Confirmation email sent" }, null, 2),
      },
      {
        method: "POST",
        path: "/api/account/delete/confirm",
        description: "Confirm account deletion with token. Body: { token }",
        auth: "session",
        example: JSON.stringify({ deleted: true }, null, 2),
      },
      {
        method: "GET",
        path: "/api/account/delete/status",
        description: "Check account deletion request status",
        auth: "session",
        example: JSON.stringify({ status: "pending", requestedAt: "2026-07-04T00:00:00.000Z" }, null, 2),
      },
    ],
  },
  {
    key: "section_v1",
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/api-keys",
        description: "List user's active API keys",
        auth: "session",
        example: JSON.stringify({ keys: [ { id: "key_123", name: "Production Key", prefix: "sk-sophia-a1b2", created_at: "2026-07-01T00:00:00.000Z", last_used_at: null, revoked: false } ] }, null, 2),
      },
      {
        method: "POST",
        path: "/api/v1/api-keys",
        description: "Create a new API key. Body: { name, permissions? } — rate limited to 5/min",
        auth: "session",
        example: JSON.stringify({ id: "key_123", name: "Production Key", key: "sk-sophia-a1b2c3d4e5f6...", prefix: "sk-sophia-a1b2", rateLimit: { requestsPerMin: 300 } }, null, 2),
      },
      {
        method: "DELETE",
        path: "/api/v1/api-keys/[id]",
        description: "Revoke (soft-delete) an API key. Returns 204 on success",
        auth: "session",
        example: "HTTP 204 No Content",
      },
      {
        method: "POST",
        path: "/api/v1/api-keys/[id]/rotate",
        description: "Rotate an API key — revokes old key and returns a new one. Body: { name? }",
        auth: "session",
        example: JSON.stringify({ id: "key_456", name: "Production Key", key: "sk-sophia-...new...", prefix: "sk-sophia-z9y8" }, null, 2),
      },
      {
        method: "GET",
        path: "/api/v1/usage",
        description: "Get API usage metrics (request count, token usage, period)",
        auth: "session",
        example: JSON.stringify({ usage: { requestsThisMonth: 1234, tokensUsed: 50000, period: { start: "2026-07-01", end: "2026-07-31" } } }, null, 2),
      },
      {
        method: "GET",
        path: "/api/v1/quota",
        description: "Get current quota usage and limits by tier",
        auth: "session",
        example: JSON.stringify({ tier: "PREMIUM", quota: { used: 45, limit: 100, resetsAt: "2026-08-01T00:00:00.000Z" } }, null, 2),
      },
      {
        method: "GET",
        path: "/api/v1/campaigns",
        description: "List user's campaigns with performance metrics",
        auth: "session",
        example: JSON.stringify({ campaigns: [ { id: "camp_1", name: "Summer Sale", status: "active", impressions: 5000, clicks: 250 } ] }, null, 2),
      },
      {
        method: "GET",
        path: "/api/v1/dashboard",
        description: "Get dashboard summary metrics for the authenticated user",
        auth: "session",
        example: JSON.stringify({ revenue: { today: 150.00, month: 4500.00 }, videos: { total: 25, thisMonth: 5 }, campaigns: { active: 3 } }, null, 2),
      },
      {
        method: "GET",
        path: "/api/v1/credits",
        description: "Get user credit balance and transaction history",
        auth: "session",
        example: JSON.stringify({ balance: 500, transactions: [ { id: "tx_1", amount: 100, type: "topup", date: "2026-07-01" } ] }, null, 2),
      },
      {
        method: "GET",
        path: "/api/v1/missions",
        description: "List user's missions (automated workflows) with status",
        auth: "session",
        example: JSON.stringify({ missions: [ { id: "mission_1", type: "video:create", status: "running", progress: 0.6 } ] }, null, 2),
      },
      {
        method: "POST",
        path: "/api/v1/missions",
        description: "Create a new mission. Body: { type, config }",
        auth: "session",
        example: JSON.stringify({ mission: { id: "mission_2", type: "video:create", status: "queued" } }, null, 2),
      },
      {
        method: "GET",
        path: "/api/v1/settings",
        description: "Get user settings including integration configurations",
        auth: "session",
        example: JSON.stringify({ settings: { integrations: { openrouter: true, elevenlabs: false }, notifications: { email: true } } }, null, 2),
      },
      {
        method: "PUT",
        path: "/api/v1/settings",
        description: "Update user settings. Body: partial settings object",
        auth: "session",
        example: JSON.stringify({ updated: true }, null, 2),
      },
      {
        method: "POST",
        path: "/api/v1/webhooks",
        description: "Register a custom webhook endpoint for receiving events. Body: { url, events[] }",
        auth: "session",
        example: JSON.stringify({ webhook: { id: "wh_1", url: "https://example.com/webhook", events: ["video.completed", "campaign.updated"], secret: "whsec_..." } }, null, 2),
      },
    ],
  },
];

function MethodBadge({ method }: { method: Endpoint["method"] }) {
  const colorMap: Record<string, string> = {
    GET: "bg-green-500/20 text-green-600",
    POST: "bg-primary/10/20 text-primary",
    PUT: "bg-orange-500/20 text-orange-600",
    PATCH: "bg-primary/10/20 text-primary",
    DELETE: "bg-red-500/20 text-red-600",
  };

  return (
    <span className={`px-2 py-1 text-xs font-mono font-bold rounded whitespace-nowrap ${colorMap[method] ?? "bg-gray-500/20 text-gray-600"}`}>
      {method}
    </span>
  );
}

function AuthBadge({ auth }: { auth: Endpoint["auth"] }) {
  if (auth === "no") {
    return <span className="text-xs text-muted-foreground">-</span>;
  }

  const labelMap: Record<string, string> = {
    yes: "auth_yes",
    bearer: "auth_bearer",
    session: "auth_session",
  };

  return (
    <span className="text-xs font-medium">{labelMap[auth]}</span>
  );
}

function EndpointRow({ endpoint, t }: { endpoint: Endpoint; t: (key: string) => string }) {
  const [showExample, setShowExample] = React.useState(false);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-start gap-3 p-3 bg-muted/30">
        <div className="flex-shrink-0 pt-0.5">
          <MethodBadge method={endpoint.method} />
        </div>
        <div className="flex-1 min-w-0">
          <code className="text-sm font-mono text-foreground break-all">{endpoint.path}</code>
          <p className="text-xs text-muted-foreground mt-1">{endpoint.description}</p>
        </div>
        <div className="flex-shrink-0 text-right min-w-[60px]">
          <AuthBadge auth={endpoint.auth} />
        </div>
      </div>
      <button
        onClick={() => setShowExample(!showExample)}
        className="w-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors text-left border-t border-border"
      >
        {showExample ? "Hide example" : `Show example (${t('endpoint_example')})`}
      </button>
      {showExample && (
        <pre className="px-3 py-2 text-xs font-mono bg-muted/20 border-t border-border overflow-x-auto">
          {endpoint.example}
        </pre>
      )}
    </div>
  );
}

export default async function ApiDocsPage() {
  const t = await getTranslations("dashboard.api_docs");
  const user = await getCurrentUser();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <ApiKeyManager />

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Code className="w-5 h-5" aria-hidden="true" />
            {t("endpoints")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
            <span className="w-[60px]">{t("endpoint_method")}</span>
            <span className="flex-1">{t("endpoint_path")}</span>
            <span className="w-[80px] text-right">{t("endpoint_auth")}</span>
          </div>

          {ENDPOINT_GROUPS.map((group) => (
            <section key={group.key}>
              <h3 className="text-sm font-semibold text-foreground mb-3">{t(group.key)}</h3>
              <div className="space-y-2">
                {group.endpoints.map((ep) => (
                  <EndpointRow key={ep.path} endpoint={ep} t={t as (key: string) => string} />
                ))}
              </div>
            </section>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Gauge className="w-5 h-5" aria-hidden="true" />
            {t("rate_limits")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("rate_limits_desc")}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-muted/50 rounded-lg border border-border">
              <span className="text-sm font-semibold text-foreground">Basic</span>
              <p className="text-xs text-muted-foreground mt-1">{t("rate_limit_basic")}</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg border border-border">
              <span className="text-sm font-semibold text-foreground">Premium</span>
              <p className="text-xs text-muted-foreground mt-1">{t("rate_limit_premium")}</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg border border-border">
              <span className="text-sm font-semibold text-foreground">Enterprise</span>
              <p className="text-xs text-muted-foreground mt-1">{t("rate_limit_enterprise")}</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg border border-border">
              <span className="text-sm font-semibold text-foreground">Master</span>
              <p className="text-xs text-muted-foreground mt-1">{t("rate_limit_master")}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="w-4 h-4" />
            {t("rate_limit_headers")}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
