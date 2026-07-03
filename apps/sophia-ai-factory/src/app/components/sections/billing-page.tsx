"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/seed/utils/cn";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/seed/components/ui/card";
import { Button } from "@/seed/components/ui/button";
import { Badge } from "@/seed/components/ui/badge";
import { Progress } from "@/seed/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/seed/components/ui/table";
import {
  CreditCard,
  Download,
  Plus,
  AlertTriangle,
  Trash2,
  Zap,
  Circle,
  CheckCircle2,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────

interface UsageMetric {
  id: string;
  label: string;
  used: number;
  total: number;
  suffix: string;
}

interface PaymentRecord {
  id: string;
  date: string;
  amount: string;
  method: string;
  status: "completed" | "pending" | "failed";
  invoice: string;
}

interface PaymentMethodItem {
  id: string;
  label: string;
  isDefault: boolean;
}

// ─── Data ────────────────────────────────────────────────────────────

const paymentHistory: PaymentRecord[] = [
  { id: "1", date: "Jul 1, 2026", amount: "$79.00", method: "Visa •••• 4242", status: "completed", invoice: "INV-2026-0701" },
  { id: "2", date: "Jun 1, 2026", amount: "$79.00", method: "Visa •••• 4242", status: "completed", invoice: "INV-2026-0601" },
  { id: "3", date: "May 1, 2026", amount: "$79.00", method: "Visa •••• 4242", status: "pending", invoice: "INV-2026-0501" },
  { id: "4", date: "Apr 1, 2026", amount: "$79.00", method: "Visa •••• 4242", status: "failed", invoice: "INV-2026-0401" },
  { id: "5", date: "Mar 1, 2026", amount: "$79.00", method: "Visa •••• 4242", status: "completed", invoice: "INV-2026-0301" },
];

const paymentMethods: PaymentMethodItem[] = [
  { id: "1", label: "Visa •••• 4242", isDefault: true },
  { id: "2", label: "Mastercard •••• 8888", isDefault: false },
];

// ─── Helpers ─────────────────────────────────────────────────────────

function statusStyle(status: string): string {
  switch (status) {
    case "completed":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "pending":
      return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    case "failed":
      return "bg-red-500/10 text-red-400 border-red-500/20";
    default:
      return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
  }
}

function statusLabel(t: (key: string) => string, status: string): string {
  switch (status) {
    case "completed":
      return t("paymentHistory.completed") || "Completed";
    case "pending":
      return t("paymentHistory.pending") || "Pending";
    case "failed":
      return t("paymentHistory.failed") || "Failed";
    default:
      return status;
  }
}

// ─── Current Plan Card ──────────────────────────────────────────────

function CurrentPlanCard({ t }: { t: (key: string) => string }) {
  return (
    <Card
      className={cn(
        "border-l-4 border-l-indigo-500 border-zinc-800 bg-zinc-900",
        "rounded-xl p-5"
      )}
    >
      <CardContent className="p-0">
        <div className="flex flex-col gap-5">
          {/* Badge + Plan Name */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Badge className="bg-indigo-500/15 text-indigo-400 border-indigo-500/30 text-xs font-semibold px-3 py-1">
                {t("currentPlan.badge") || "PREMIUM"}
              </Badge>
              <h2 className="text-xl font-bold text-white">
                {t("currentPlan.planName") || "Annual Premium Plan"}
              </h2>
            </div>
          </div>

          {/* Price */}
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[28px] font-bold text-white">
                {t("currentPlan.price") || "$79/mo"}
              </span>
              <span className="text-[13px] font-normal text-zinc-400">
                {t("currentPlan.billedAnnually") || "billed annually ($948/yr)"}
              </span>
            </div>
          </div>

          {/* Status */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Circle className="h-2.5 w-2.5 fill-emerald-400 text-emerald-400" aria-hidden="true" />
              <span className="text-sm text-emerald-400 font-medium">
                {t("currentPlan.status") || "Active"}
              </span>
            </div>
            <span className="text-sm text-zinc-400">
              {t("currentPlan.nextBilling") || "Next billing: Aug 15, 2026"}
            </span>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="ghost"
              className="text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
            >
              {t("currentPlan.changePlan") || "Change Plan"}
            </Button>
            <Button
              variant="outline"
              className="border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
            >
              {t("currentPlan.cancel") || "Cancel Subscription"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Usage Card ─────────────────────────────────────────────────────

function UsageCard({ t }: { t: (key: string) => string }) {
  const usageMetrics: UsageMetric[] = useMemo(
    () => [
      { id: "videos", label: t("usage.aiVideos") || "AI Videos", used: 47, total: 100, suffix: "" },
      { id: "campaigns", label: t("usage.campaigns") || "Campaigns", used: 8, total: 50, suffix: "" },
      { id: "storage", label: t("usage.storage") || "Storage", used: 2.4, total: 10, suffix: "GB" },
    ],
    [t]
  );

  return (
    <Card className="border-zinc-800 bg-zinc-900 rounded-xl">
      <CardHeader className="p-5 pb-3">
        <CardTitle className="text-lg font-semibold text-white">
          {t("usage.title") || "This Month’s Usage"}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        <div className="grid gap-4 sm:grid-cols-3">
          {usageMetrics.map((metric) => {
            const displayUsed =
              metric.suffix === "GB"
                ? metric.used.toFixed(1)
                : metric.used.toString();
            const displayTotal =
              metric.suffix === "GB"
                ? metric.total.toFixed(0)
                : metric.total.toString();

            return (
              <div
                key={metric.id}
                className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4"
              >
                <p className="text-sm text-zinc-400 mb-2">
                  {metric.label}
                </p>
                <p className="text-2xl font-bold text-white">
                  {displayUsed}
                  {metric.suffix}
                  <span className="text-sm font-normal text-zinc-500">
                    {" "}{t("usage.of") || "of"}{" "}
                  </span>
                  {displayTotal}
                  {metric.suffix}
                </p>
                <Progress
                  value={metric.used}
                  max={metric.total}
                  className="mt-3 h-2 bg-zinc-800"
                  indicatorClassName="bg-indigo-500"
                />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Payment History Table ──────────────────────────────────────────

function PaymentHistoryTable({ t }: { t: (key: string) => string }) {
  return (
    <Card className="border-zinc-800 bg-zinc-900 rounded-xl">
      <CardHeader className="p-5 pb-3">
        <CardTitle className="text-lg font-semibold text-white">
          {t("paymentHistory.title") || "Payment History"}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-transparent">
              <TableHead className="text-zinc-400 font-medium text-xs uppercase tracking-wider px-5 py-3">
                {t("paymentHistory.date") || "Date"}
              </TableHead>
              <TableHead className="text-zinc-400 font-medium text-xs uppercase tracking-wider px-5 py-3">
                {t("paymentHistory.amount") || "Amount"}
              </TableHead>
              <TableHead className="text-zinc-400 font-medium text-xs uppercase tracking-wider px-5 py-3">
                {t("paymentHistory.method") || "Method"}
              </TableHead>
              <TableHead className="text-zinc-400 font-medium text-xs uppercase tracking-wider px-5 py-3">
                {t("paymentHistory.status") || "Status"}
              </TableHead>
              <TableHead className="text-zinc-400 font-medium text-xs uppercase tracking-wider px-5 py-3 text-right">
                {t("paymentHistory.invoice") || "Invoice"}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paymentHistory.map((record) => (
              <TableRow
                key={record.id}
                className="border-zinc-800 hover:bg-zinc-800/30"
              >
                <TableCell className="px-5 py-3.5 text-sm text-white">
                  {record.date}
                </TableCell>
                <TableCell className="px-5 py-3.5 text-sm text-white font-medium">
                  {record.amount}
                </TableCell>
                <TableCell className="px-5 py-3.5 text-sm text-zinc-400">
                  {record.method}
                </TableCell>
                <TableCell className="px-5 py-3.5">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border",
                      statusStyle(record.status)
                    )}
                  >
                    {statusLabel(t, record.status)}
                  </span>
                </TableCell>
                <TableCell className="px-5 py-3.5 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 h-8 px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
                    aria-label={`${t("paymentHistory.downloadInvoice") || "Download"} ${record.invoice}`}
                  >
                    <Download className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                    {record.invoice}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─── Payment Methods Card ───────────────────────────────────────────

function PaymentMethodsSection({ t }: { t: (key: string) => string }) {
  return (
    <Card className="border-zinc-800 bg-zinc-900 rounded-xl">
      <CardHeader className="p-5 pb-3">
        <CardTitle className="text-lg font-semibold text-white">
          {t("paymentMethods.title") || "Payment Methods"}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5 pt-0 space-y-3">
        {paymentMethods.map((method) => (
          <div
            key={method.id}
            className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/50 p-3.5"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10">
                <CreditCard className="h-4.5 w-4.5 text-indigo-400" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">{method.label}</p>
                {method.isDefault && (
                  <p className="text-xs text-indigo-400">
                    {t("paymentMethods.default") || "Default"}
                  </p>
                )}
              </div>
            </div>
            <CheckCircle2
              className={cn(
                "h-5 w-5",
                method.isDefault ? "text-indigo-400" : "text-zinc-600"
              )}
              aria-hidden="true"
            />
          </div>
        ))}

        <Button
          variant="ghost"
          className="w-full justify-center text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
        >
          <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
          {t("paymentMethods.addMethod") || "Add Payment Method"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Top Up Credits Card ────────────────────────────────────────────

function TopUpCreditsCard({ t }: { t: (key: string) => string }) {
  return (
    <Card className="border-indigo-500/30 bg-indigo-500/10 rounded-xl">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20">
            <Zap className="h-5 w-5 text-indigo-400" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-white">
              {t("topUp.title") || "Top Up Credits"}
            </h3>
            <p className="mt-1 text-sm text-zinc-400">
              {t("topUp.description") || "Need more AI video credits? Top up instantly to keep your campaigns running."}
            </p>
            <Button className="mt-3 bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900">
              {t("topUp.button") || "Buy Credits"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Danger Zone ────────────────────────────────────────────────────

function DangerZoneCard({ t }: { t: (key: string) => string }) {
  return (
    <Card className="border-red-500/30 bg-zinc-900 rounded-xl">
      <CardHeader className="p-5 pb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-400" aria-hidden="true" />
          <CardTitle className="text-lg font-semibold text-red-400">
            {t("dangerZone.title") || "Danger Zone"}
          </CardTitle>
        </div>
        <CardDescription className="text-zinc-400">
          {t("dangerZone.description") || "Irreversible actions. Proceed with caution."}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        <div className="flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-white">
              {t("dangerZone.deleteButton") || "Delete Billing Profile"}
            </p>
            <p className="text-xs text-zinc-400">
              {t("dangerZone.deleteHint") || "Permanently remove your billing information"}
            </p>
          </div>
          <Button
            variant="outline"
            className="border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
          >
            <Trash2 className="mr-1.5 h-5 w-5" aria-hidden="true" />
            {t("dangerZone.delete") || "Delete"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ─────────────────────────────────────────────────

export default function BillingPage() {
  const t = useTranslations("billing");

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="text-sm text-zinc-400">
        <ol className="flex items-center gap-2">
          <li>
            <span className="text-white">{t("pageTitle") || "Billing"}</span>
          </li>
        </ol>
      </nav>

      {/* Page Heading */}
      <div>
        <h1 className="text-[28px] font-bold leading-tight text-white">
          {t("pageTitle") || "Billing"}
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          {t("pageSubtitle") || "Manage your subscription, usage, and payment methods"}
        </p>
      </div>

      {/* Current Plan */}
      <CurrentPlanCard t={t} />

      {/* Usage */}
      <UsageCard t={t} />

      {/* Split Section: Payment History + Payment Methods */}
      <div className="grid gap-4 lg:grid-cols-2">
        <PaymentHistoryTable t={t} />
        <div className="space-y-4">
          <PaymentMethodsSection t={t} />
          <TopUpCreditsCard t={t} />
        </div>
      </div>

      {/* Danger Zone */}
      <DangerZoneCard t={t} />
    </div>
  );
}
