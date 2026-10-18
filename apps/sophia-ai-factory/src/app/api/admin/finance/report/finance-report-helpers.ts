/**
 * Internal helpers for GET /api/admin/finance/report
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "@/land/webhooks/signature";
import type { getD1Database } from "@/land/analytics/cohort-calculator";

const INTERNAL_SECRET = process.env.INTERNAL_SECRET || process.env.X_INTERNAL_SECRET || "";

type D1Db = ReturnType<typeof getD1Database>;

/**
 * Timing-safe internal secret verification.
 * Rejects when INTERNAL_SECRET is not configured (empty) to prevent bypass.
 */
export function requireInternal(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret") || "";
  if (!INTERNAL_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!timingSafeEqual(secret, INTERNAL_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

export function parsePeriod(fromStr: string, toStr: string) {
  const from = fromStr ? new Date(fromStr) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const to = toStr ? new Date(toStr) : new Date();
  const fromSec = Math.floor(from.getTime() / 1000);
  const toSec = Math.floor(to.getTime() / 1000);
  return { fromSec, toSec, from, to };
}

export async function generateFinanceReportData(
  db: D1Db,
  period: string,
  fromSec: number,
  toSec: number,
  from: Date,
  to: Date,
) {
  const revenueRow = await db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) AS gross_debits,
              COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) AS credits,
              COUNT(CASE WHEN type = 'debit' THEN 1 END) AS tx_count
       FROM billing_events
       WHERE created_at >= ?1 AND created_at < ?2`
    )
    .bind(fromSec, toSec)
    .first<{ gross_debits: number; credits: number; tx_count: number }>();

  const revenue = (revenueRow?.gross_debits ?? 0) - (revenueRow?.credits ?? 0);
  const txCount = revenueRow?.tx_count ?? 0;

  const cogsRatio = 0.15;
  const cogs = Math.round(revenue * cogsRatio);
  const grossProfit = revenue - cogs;

  const monthlyBurn = parseInt(process.env.FINANCE_MONTHLY_BURN_USD || "45000", 10);
  const opex = Math.round(monthlyBurn * ((toSec - fromSec) / (30 * 24 * 60 * 60)));
  const net = grossProfit - opex;

  const prevMonthFrom = new Date(from);
  prevMonthFrom.setMonth(prevMonthFrom.getMonth() - 1);
  const prevMonthTo = new Date(from);
  prevMonthTo.setDate(prevMonthTo.getDate() - 1);

  const prevRow = await db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) AS prev_revenue
       FROM billing_events
       WHERE type = 'debit'
         AND created_at >= ?1
         AND created_at < ?2`
    )
    .bind(Math.floor(prevMonthFrom.getTime() / 1000), Math.floor(prevMonthTo.getTime() / 1000))
    .first<{ prev_revenue: number }>();

  const mrrStart = prevRow?.prev_revenue ?? 0;
  const mrrEnd = mrrStart + (revenue - opex > 0 ? revenue - opex : 0);
  const mrrWaterfall = {
    start: mrrStart,
    new: Math.round(revenue * 0.15),
    expansion: Math.round(revenue * 0.05),
    churn: Math.round(mrrStart * 0.03),
    contraction: Math.round(mrrStart * 0.02),
    end: mrrEnd,
  };

  const activeCustomers = txCount > 0 ? Math.max(1, Math.round(txCount / 3)) : 1;
  const arpu = activeCustomers > 0 ? Math.round(revenue / activeCustomers) : 0;
  const churnRate = 0.035;
  const ltv = arpu > 0 ? Math.round(arpu / churnRate) : 0;
  const cac = parseInt(process.env.FINANCE_CAC_USD || "140", 10);
  const ltvCac = cac > 0 ? Math.round((ltv / cac) * 10) / 10 : 0;

  return {
    period,
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    pnl: {
      revenue,
      cogs,
      gross_profit: grossProfit,
      gross_margin_pct: revenue > 0 ? Math.round((grossProfit / revenue) * 1000) / 10 : 0,
      opex,
      net,
      net_margin_pct: revenue > 0 ? Math.round((net / revenue) * 1000) / 10 : 0,
    },
    mrr_waterfall: mrrWaterfall,
    metrics: {
      active_customers: activeCustomers,
      arpu,
      ltv,
      cac,
      churn_rate: Math.round(churnRate * 1000) / 10,
      ltv_cac: ltvCac,
      tx_count: txCount,
    },
    notes: [
      "COGS estimated at 15% of revenue — replace with actual cost ingestion.",
      "OpEx seeded from FINANCE_MONTHLY_BURN_USD env var.",
      "MRR waterfall simplified — replace with subscription_events analysis.",
      "LTV/CAC use placeholder churn rate — implement cohort analysis for production.",
    ],
  };
}
