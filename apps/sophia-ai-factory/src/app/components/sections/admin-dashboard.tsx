"use client";

import { cn } from "@/seed/utils/cn";
import { Link } from "@/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/seed/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/seed/components/ui/table";
import { Badge } from "@/seed/components/ui/badge";
import {
  Users,
  DollarSign,
  Activity,
  Clock,
  Gauge,
  Database,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────

interface AdminKpiProps {
  label: string;
  value: string;
  change?: { value: string; positive: boolean };
  icon: React.ElementType;
  subtext?: string;
}

interface SignupRow {
  name: string;
  email: string;
  tier: string;
  date: string;
  status: "active" | "pending" | "inactive";
}

interface DeployService {
  name: string;
  status: "healthy" | "degraded" | "down";
  version: string;
  uptime: string;
}

// ─── KPI Card ─────────────────────────────────────────────────────

function AdminKpiCard({ label, value, change, icon: Icon, subtext }: AdminKpiProps) {
  return (
    <Card className="border-zinc-800 bg-zinc-900">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-zinc-400">{label}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
            {change && (
              <div className="flex items-center gap-1">
                {change.positive ? (
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-red-400" aria-hidden="true" />
                )}
                <span
                  className={cn(
                    "text-xs font-medium",
                    change.positive ? "text-emerald-400" : "text-red-400"
                  )}
                >
                  {change.value}
                </span>
              </div>
            )}
            {subtext && <p className="text-xs text-zinc-400">{subtext}</p>}
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10">
            <Icon className="h-5 w-5 text-indigo-400" aria-hidden="true" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── User Growth Chart Placeholder ────────────────────────────────

function UserGrowthChart() {
  return (
    <div className="relative h-64 w-full overflow-hidden rounded-lg">
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="user-growth-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366F1" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#6366F1" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Grid lines */}
        {[0, 1, 2, 3, 4].map((i) => (
          <line
            key={i}
            x1="0"
            y1={52 * (i + 0.5)}
            x2="100%"
            y2={52 * (i + 0.5)}
            className="stroke-zinc-800"
            strokeWidth="1"
          />
        ))}
        {/* Area fill */}
        <path
          d="M0,240 C60,220 120,190 180,170 C240,150 300,130 360,100 C420,70 480,90 540,60 C600,30 660,45 720,35 L720,260 L0,260 Z"
          fill="url(#user-growth-gradient)"
        />
        {/* Line */}
        <path
          d="M0,240 C60,220 120,190 180,170 C240,150 300,130 360,100 C420,70 480,90 540,60 C600,30 660,45 720,35"
          fill="none"
          className="stroke-indigo-500"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* Data points */}
        {[
          [0, 240],
          [60, 220],
          [120, 190],
          [180, 170],
          [240, 150],
          [300, 130],
          [360, 100],
          [420, 70],
          [480, 90],
          [540, 60],
          [600, 30],
          [660, 45],
          [720, 35],
        ].map(([cx, cy], i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r="3"
            className="fill-indigo-500 stroke-zinc-900"
            strokeWidth="2"
          />
        ))}
      </svg>
    </div>
  );
}

// ─── System Health Panel ──────────────────────────────────────────

const systemMetrics = [
  { label: "API Response Time", value: "142ms", status: "healthy" },
  { label: "Error Rate", value: "0.02%", status: "healthy" },
  { label: "Memory Usage", value: "68%", status: "healthy" },
  { label: "CPU Load", value: "42%", status: "healthy" },
  { label: "D1 Connections", value: "23/100", status: "healthy" },
  { label: "R2 Cache Hit Rate", value: "87%", status: "healthy" },
];

function SystemHealthPanel() {
  return (
    <div className="space-y-3">
      {systemMetrics.map((metric) => (
        <div key={metric.label} className="flex items-center justify-between rounded-lg border border-zinc-800 px-4 py-3">
          <span className="text-sm text-zinc-400">{metric.label}</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">{metric.value}</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Recent Signups ───────────────────────────────────────────────

const recentSignups: SignupRow[] = [
  { name: "Nguyen Van A", email: "nguyenvana@example.com", tier: "Enterprise", date: "2026-07-03", status: "active" },
  { name: "Tran Thi B", email: "tranthib@example.com", tier: "Premium", date: "2026-07-02", status: "active" },
  { name: "Le Van C", email: "levanc@example.com", tier: "Basic", date: "2026-07-02", status: "pending" },
  { name: "Pham Thi D", email: "phamthid@example.com", tier: "Premium", date: "2026-07-01", status: "active" },
  { name: "Hoang Van E", email: "hoangvane@example.com", tier: "Basic", date: "2026-06-30", status: "inactive" },
  { name: "Do Thi F", email: "dothif@example.com", tier: "Enterprise", date: "2026-06-29", status: "active" },
];

const signupStatusVariant = (status: SignupRow["status"]): "destructive" | "basic" | "secondary" | "default" | "outline" | "premium" | "enterprise" => {
  switch (status) {
    case "active": return "basic";
    case "pending": return "secondary";
    case "inactive": return "destructive";
  }
};

// ─── Deploy Status ────────────────────────────────────────────────

const deployServices: DeployService[] = [
  { name: "Web App", status: "healthy", version: "v2.14.3", uptime: "99.97%" },
  { name: "API Server", status: "healthy", version: "v2.14.3", uptime: "99.95%" },
  { name: "D1 Database", status: "healthy", version: "migration-047", uptime: "99.99%" },
  { name: "R2 Cache", status: "healthy", version: "n/a", uptime: "99.98%" },
  { name: "Inngest Queue", status: "degraded", version: "n/a", uptime: "98.50%" },
];

const deployStatusIcon = (status: DeployService["status"]) => {
  switch (status) {
    case "healthy": return <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />;
    case "degraded": return <AlertTriangle className="h-4 w-4 text-amber-400" aria-hidden="true" />;
    case "down": return <XCircle className="h-4 w-4 text-red-400" aria-hidden="true" />;
  }
};

// ─── Main Component ───────────────────────────────────────────────

export function AdminDashboard() {
  return (
    <div className="space-y-6 bg-[#0F0F11]">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="text-sm text-zinc-400">
        <ol className="flex items-center gap-2">
          <li>
            <Link href="/dashboard" className="hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 rounded-sm">Dashboard</Link>
          </li>
          <li aria-hidden="true" className="text-zinc-600">/</li>
          <li>
            <span className="text-white">Admin</span>
          </li>
        </ol>
      </nav>

      {/* Page Heading */}
      <div>
        <h1 className="text-[28px] font-bold leading-tight text-white">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-400">System-wide metrics and operations</p>
      </div>

      {/* 6 KPI Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <AdminKpiCard
          label="DAU"
          value="1,847"
          change={{ value: "+5.2% vs last week", positive: true }}
          icon={Users}
        />
        <AdminKpiCard
          label="MRR"
          value="$48,230"
          change={{ value: "+8.7% vs last month", positive: true }}
          icon={DollarSign}
        />
        <AdminKpiCard
          label="Active Users"
          value="12,458"
          change={{ value: "+3.1% vs last week", positive: true }}
          icon={Activity}
        />
        <AdminKpiCard
          label="Uptime"
          value="99.97%"
          change={{ value: "30d avg", positive: true }}
          icon={Clock}
        />
        <AdminKpiCard
          label="Latency (p99)"
          value="245ms"
          change={{ value: "-12ms improvement", positive: true }}
          icon={Gauge}
        />
        <AdminKpiCard
          label="D1 Queries"
          value="2.4M"
          subtext="Today: 847K queries"
          icon={Database}
        />
      </div>

      {/* User Growth Chart + System Health */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* User Growth (left 2/3) */}
        <div className="lg:col-span-2">
          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-white">User Growth</CardTitle>
              <CardDescription className="text-zinc-400">
                New user signups over the last 30 days
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UserGrowthChart />
            </CardContent>
          </Card>
        </div>

        {/* System Health (right 1/3) */}
        <div>
          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-white">System Health</CardTitle>
              <CardDescription className="text-zinc-400">
                All systems operational
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SystemHealthPanel />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Signups + Deploy Status */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Signups (left 2/3) */}
        <div className="lg:col-span-2">
          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-white">Recent Signups</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-zinc-400">Name</TableHead>
                    <TableHead className="text-zinc-400">Email</TableHead>
                    <TableHead className="text-zinc-400">Tier</TableHead>
                    <TableHead className="text-zinc-400">Date</TableHead>
                    <TableHead className="text-right text-zinc-400">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentSignups.map((signup) => (
                    <TableRow key={signup.email} className="border-zinc-800 hover:bg-zinc-800/50">
                      <TableCell className="font-medium text-white">{signup.name}</TableCell>
                      <TableCell className="text-zinc-400">{signup.email}</TableCell>
                      <TableCell>
                        <Badge variant={signup.tier.toLowerCase() as "basic" | "premium" | "enterprise"}>
                          {signup.tier}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-zinc-400">{signup.date}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={signupStatusVariant(signup.status)} className="capitalize">
                          {signup.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Deploy Status (right 1/3) */}
        <div>
          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-white">Deploy Status</CardTitle>
              <CardDescription className="text-zinc-400">
                Current deployment health
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-zinc-800">
                {deployServices.map((service) => (
                  <div key={service.name} className="flex items-center justify-between px-5 py-3.5">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-white">{service.name}</p>
                      <p className="text-xs text-zinc-400">
                        {service.version} &middot; {service.uptime} uptime
                      </p>
                    </div>
                    {deployStatusIcon(service.status)}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
