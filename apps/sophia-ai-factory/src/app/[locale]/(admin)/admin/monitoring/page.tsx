import { redirect } from "next/navigation";
import { getCurrentUser } from "@/seed/auth/better-auth-session";
import { Card, CardContent, CardHeader, CardTitle } from "@/seed/components/ui/card";
import { Activity, AlertTriangle, Database, Workflow, Gauge, Cpu } from "lucide-react";
import {
  getCacheStats,
  getWorkflowStats,
  getSignalsStats,
  getTraceStats,
  cacheHitRate,
  type TraceStats,
} from "@/tree/admin/monitoring-queries";

export const dynamic = "force-dynamic";

/**
 * Admin Monitoring Dashboard — Phase 4.7 (PDF Giai đoạn 4 Bước 4.7).
 *
 * Server-rendered on every request. Aggregates LLM cache + workflows +
 * signals from D1. No client polling — operator hard-reloads for fresh data.
 */
export default async function AdminMonitoringPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    redirect("/dashboard");
  }

  const [cacheRes, workflowsRes, signalsRes, traceStats] = await Promise.all([
    getCacheStats(),
    getWorkflowStats(),
    getSignalsStats(10),
    getTraceStats(),
  ]);

  const cache     = cacheRes.data;
  const workflows = workflowsRes.data;
  const signals   = signalsRes.data;
  const degraded  = !cacheRes.ok || !workflowsRes.ok || !signalsRes.ok;

  const hitRatePct = (cacheHitRate(cache) * 100).toFixed(1);
  const tokensSavedFmt = new Intl.NumberFormat("en-US").format(cache.tokensSaved);
  const totalWorkflows24h = workflows.queued + workflows.running + workflows.completed + workflows.failed;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Monitoring</h1>
        <p className="text-muted-foreground">
          Recent Sophia signals, workflows and LLM cache (D1 aggregates, 24h window).
        </p>
      </div>

      {degraded && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
        >
          <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">D1 degraded — one or more queries failed.</p>
            <p className="text-red-300/80">
              Numbers below may be stale or zero. Reload the page to retry.
            </p>
          </div>
        </div>
      )}

      {/* LLM Cache cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          label="Cache entries"
          value={cache.total.toString()}
          sub={`${cache.fresh} fresh · ${cache.expired} expired`}
          icon={Database}
          color="text-[var(--neon-cyan)]"
          bg="bg-[var(--neon-cyan)]/10"
        />
        <StatCard
          label="Total cache hits"
          value={cache.totalHits.toString()}
          sub={`ratio ${hitRatePct}% (hits / (hits + entries))`}
          icon={Gauge}
          color="text-green-400"
          bg="bg-green-400/10"
        />
        <StatCard
          label="Tokens saved"
          value={tokensSavedFmt}
          sub="Σ (input+output) × hit_count"
          icon={Activity}
          color="text-[var(--neon-purple)]"
          bg="bg-[var(--neon-purple)]/10"
        />
        <StatCard
          label="Workflows (24h)"
          value={totalWorkflows24h.toString()}
          sub={`${workflows.completed} ok · ${workflows.failed} failed`}
          icon={Workflow}
          color="text-yellow-400"
          bg="bg-yellow-400/10"
        />
      </div>

      {/* Workflow breakdown */}
      <Card className="bg-card border-border shadow-sm mb-8">
        <CardHeader>
          <CardTitle className="text-foreground">Workflows — last 24h</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <WorkflowPill label="Queued"    value={workflows.queued}    tone="muted" />
            <WorkflowPill label="Running"   value={workflows.running}   tone="info" />
            <WorkflowPill label="Completed" value={workflows.completed} tone="ok" />
            <WorkflowPill label="Failed"    value={workflows.failed}    tone="error" />
          </div>
        </CardContent>
      </Card>

      {/* Top signals events */}
      <Card className="bg-card border-border shadow-sm mb-8">
        <CardHeader>
          <CardTitle className="text-foreground">Top signals — last 24h</CardTitle>
        </CardHeader>
        <CardContent>
          {signals.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No signals recorded in the last 24 hours.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {signals.map((s) => (
                <li key={s.eventType} className="flex items-center justify-between py-2">
                  <span className="font-mono text-sm text-foreground">{s.eventType}</span>
                  <span className="text-sm tabular-nums text-muted-foreground">{s.count}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* LLM Trace (24h) — Phase 4K */}
      <LlmTraceSection stats={traceStats} />
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  sub:   string;
  icon:  React.ComponentType<{ className?: string }>;
  color: string;
  bg:    string;
}

function StatCard({ label, value, sub, icon: Icon, color, bg }: StatCardProps) {
  return (
    <Card className="bg-card border-border shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{label}</p>
            <p className="text-3xl font-bold text-foreground tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{sub}</p>
          </div>
          <div className={`p-3 rounded-lg ${bg}`}>
            <Icon className={`w-6 h-6 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface WorkflowPillProps {
  label: string;
  value: number;
  tone:  "muted" | "info" | "ok" | "error";
}

function WorkflowPill({ label, value, tone }: WorkflowPillProps) {
  const toneClass = {
    muted: "bg-muted text-muted-foreground",
    info:  "bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)]",
    ok:    "bg-green-400/10 text-green-400",
    error: "bg-red-500/10 text-red-400",
  }[tone];

  return (
    <div className={`rounded-lg px-4 py-3 ${toneClass}`}>
      <p className="text-xs uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

// ── LLM Trace section — Phase 4K ─────────────────────────────────────────────

interface LlmTraceSectionProps {
  stats: TraceStats | null;
}

function LlmTraceSection({ stats }: LlmTraceSectionProps) {
  const empty = stats === null || stats.total === 0;

  return (
    <div>
      <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
        <Cpu className="w-5 h-5 text-[var(--neon-cyan)]" />
        LLM Trace (24h)
      </h2>

      {empty ? (
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">No LLM traces yet</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 4 summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <StatCard
              label="Total Calls"
              value={stats.total.toString()}
              sub="llm_call_trace events"
              icon={Cpu}
              color="text-[var(--neon-cyan)]"
              bg="bg-[var(--neon-cyan)]/10"
            />
            <StatCard
              label="Success Rate"
              value={`${(stats.successRate * 100).toFixed(1)}%`}
              sub={`${stats.success} ok · ${stats.failure} failed`}
              icon={Activity}
              color="text-green-400"
              bg="bg-green-400/10"
            />
            <StatCard
              label="Avg Duration"
              value={`${stats.avgDurationMs.toFixed(0)} ms`}
              sub="mean per trace"
              icon={Gauge}
              color="text-yellow-400"
              bg="bg-yellow-400/10"
            />
            <StatCard
              label="Failures"
              value={stats.failure.toString()}
              sub="trace ok=false"
              icon={AlertTriangle}
              color="text-red-400"
              bg="bg-red-500/10"
            />
          </div>

          {/* Provider + Model breakdown tables */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-card border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-foreground text-base">Top Provider</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-border">
                  {stats.byProvider.map((p) => (
                    <li key={p.provider} className="flex items-center justify-between py-2">
                      <span className="font-mono text-sm text-foreground">{p.provider}</span>
                      <span className="text-sm tabular-nums text-muted-foreground">{p.count}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-foreground text-base">Top Model</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-border">
                  {stats.byModel.map((m) => (
                    <li key={m.model} className="flex items-center justify-between py-2">
                      <span className="font-mono text-sm text-foreground">{m.model}</span>
                      <span className="text-sm tabular-nums text-muted-foreground">{m.count}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
