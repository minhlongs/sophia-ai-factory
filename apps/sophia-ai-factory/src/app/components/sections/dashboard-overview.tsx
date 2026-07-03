"use client";

import { cn } from "@/seed/utils/cn";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/seed/components/ui/card";
import { Progress } from "@/seed/components/ui/progress";
import { Badge } from "@/seed/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/seed/components/ui/table";
import {
  TrendingUp,
  TrendingDown,
  Eye,
  DollarSign,
  Zap,
  Play,
  Plus,
  FileText,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  change?: { value: string; positive: boolean };
  icon: React.ElementType;
  progress?: { current: number; max: number };
}

interface CampaignRow {
  name: string;
  status: "active" | "paused" | "completed";
  views: string;
  revenue: string;
  updatedAt: string;
}

interface QuickAction {
  label: string;
  description: string;
  icon: React.ElementType;
  href?: string;
}

// ─── KPI Metric Card ──────────────────────────────────────────────

function KpiCard({ label, value, change, icon: Icon, progress: progressData }: KpiCardProps) {
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
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10">
            <Icon className="h-5 w-5 text-indigo-400" aria-hidden="true" />
          </div>
        </div>
        {progressData && (
          <div className="mt-4 space-y-1">
            <div className="flex justify-between text-xs text-zinc-400">
              <span>
                {progressData.current.toLocaleString()} / {progressData.max.toLocaleString()}
              </span>
              <span>{Math.round((progressData.current / progressData.max) * 100)}%</span>
            </div>
            <Progress
              value={(progressData.current / progressData.max) * 100}
              className="h-2 bg-zinc-700"
              indicatorClassName="bg-indigo-500"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Area Chart Placeholder ───────────────────────────────────────

function AreaChartPlaceholder() {
  return (
    <div className="relative h-64 w-full overflow-hidden rounded-lg">
      {/* Grid lines */}
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="area-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366F1" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#6366F1" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Y-axis grid lines */}
        {[0, 1, 2, 3].map((i) => (
          <line
            key={i}
            x1="0"
            y1={64 * (i + 0.5)}
            x2="100%"
            y2={64 * (i + 0.5)}
            stroke="#27272A"
            strokeWidth="1"
          />
        ))}
        {/* Area fill */}
        <path
          d="M0,200 C80,180 160,120 240,140 C320,160 400,80 480,100 C560,120 640,60 720,80 L720,260 L0,260 Z"
          fill="url(#area-gradient)"
        />
        {/* Line */}
        <path
          d="M0,200 C80,180 160,120 240,140 C320,160 400,80 480,100 C560,120 640,60 720,80"
          fill="none"
          stroke="#6366F1"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Data points */}
        {[
          [0, 200],
          [80, 180],
          [160, 120],
          [240, 140],
          [320, 160],
          [400, 80],
          [480, 100],
          [560, 120],
          [640, 60],
          [720, 80],
        ].map(([cx, cy], i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r="3"
            fill="#6366F1"
            stroke="#18181B"
            strokeWidth="2"
          />
        ))}
      </svg>
    </div>
  );
}

// ─── Recent Campaigns Table ───────────────────────────────────────

const recentCampaigns: CampaignRow[] = [
  { name: "Summer Sale 2026", status: "active", views: "124.5K", revenue: "$4,280", updatedAt: "2 hours ago" },
  { name: "Product Launch Q3", status: "active", views: "89.2K", revenue: "$3,150", updatedAt: "5 hours ago" },
  { name: "Brand Awareness", status: "paused", views: "245.1K", revenue: "$8,920", updatedAt: "1 day ago" },
  { name: "Holiday Campaign", status: "completed", views: "512.8K", revenue: "$18,430", updatedAt: "3 days ago" },
  { name: "Flash Sale May", status: "completed", views: "98.4K", revenue: "$2,670", updatedAt: "1 week ago" },
];

const statusVariant = (status: CampaignRow["status"]): "default" | "secondary" | "outline" | "basic" | "premium" | "enterprise" | "destructive" => {
  switch (status) {
    case "active": return "basic";
    case "paused": return "secondary";
    case "completed": return "outline";
  }
};

// ─── Quick Actions ────────────────────────────────────────────────

const quickActions: QuickAction[] = [
  { label: "New Campaign", description: "Create a new video campaign", icon: Plus },
  { label: "View Analytics", description: "Check your performance metrics", icon: TrendingUp },
  { label: "Generate Video", description: "Create AI-powered video content", icon: Play },
  { label: "Export Report", description: "Download campaign reports", icon: FileText },
];

function QuickActionCard({ action }: { action: QuickAction }) {
  const Icon = action.icon;
  return (
    <button
      type="button"
      className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-left transition-all hover:border-indigo-500/30 hover:bg-indigo-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10">
        <Icon className="h-5 w-5 text-indigo-400" aria-hidden="true" />
      </div>
      <div>
        <p className="text-sm font-medium text-white">{action.label}</p>
        <p className="text-xs text-zinc-400">{action.description}</p>
      </div>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────

export function DashboardOverview() {
  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="text-sm text-zinc-400">
        <ol className="flex items-center gap-2">
          <li>
            <span className="text-white">Dashboard</span>
          </li>
        </ol>
      </nav>

      {/* Page Heading */}
      <div>
        <h1 className="text-[28px] font-bold leading-tight text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-400">Welcome back! Here is your campaign overview.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Active Campaigns"
          value="24"
          change={{ value: "+12% this week", positive: true }}
          icon={Zap}
        />
        <KpiCard
          label="Total Views"
          value="847K"
          change={{ value: "+8.2% this week", positive: true }}
          icon={Eye}
        />
        <KpiCard
          label="Revenue MTD"
          value="$12,847"
          change={{ value: "+23% this month", positive: true }}
          icon={DollarSign}
        />
        <KpiCard
          label="Credits Used"
          value="3,421 / 10,000"
          icon={Zap}
          progress={{ current: 3421, max: 10000 }}
        />
      </div>

      {/* Performance Chart */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-lg font-semibold text-white">Performance Overview</CardTitle>
            <p className="text-sm text-zinc-400">Views and engagement over time</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-zinc-400">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-indigo-500" />
              Views
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <AreaChartPlaceholder />
        </CardContent>
      </Card>

      {/* Bottom Split: Recent Campaigns Table + Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Campaigns Table (left 2/3) */}
        <div className="lg:col-span-2">
          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-white">Recent Campaigns</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-zinc-400">Campaign</TableHead>
                    <TableHead className="text-zinc-400">Status</TableHead>
                    <TableHead className="text-zinc-400">Views</TableHead>
                    <TableHead className="text-zinc-400">Revenue</TableHead>
                    <TableHead className="text-right text-zinc-400">Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentCampaigns.map((campaign) => (
                    <TableRow key={campaign.name} className="border-zinc-800 hover:bg-zinc-800/50">
                      <TableCell className="font-medium text-white">{campaign.name}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(campaign.status)} className="capitalize">
                          {campaign.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-zinc-400">{campaign.views}</TableCell>
                      <TableCell className="text-white">{campaign.revenue}</TableCell>
                      <TableCell className="text-right text-zinc-400">{campaign.updatedAt}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions (right 1/3) */}
        <div>
          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-white">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {quickActions.map((action) => (
                <QuickActionCard key={action.label} action={action} />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
