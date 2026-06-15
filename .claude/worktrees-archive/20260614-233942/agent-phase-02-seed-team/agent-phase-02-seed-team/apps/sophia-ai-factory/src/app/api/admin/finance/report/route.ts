/**
 * GET /api/admin/finance/report
 *
 * Generates automated financial reports from D1 billing ledger.
 *
 * Query params:
 *   - period: monthly | quarterly | ytd (default: monthly)
 *   - from: YYYY-MM-DD (default: first day of current month)
 *   - to: YYYY-MM-DD (default: today)
 *
 * Returns:
 *   {
 *     period, from, to,
 *     pnl: { revenue, cogs, gross_profit, opex, net },
 *     mrr_waterfall: { start, new, expansion, churn, contraction, end },
 *     metrics: { arpu, ltv, cac, churn_rate, ltv_cac }
 *   }
 *
 * Access: admin only (requires x-internal-secret or auth middleware).
 */

import { NextRequest, NextResponse } from "next/server";
import { getD1Database } from "@/land/analytics/cohort-calculator";
import { requireAdminWithRecentAuth } from "@/seed/auth/require-admin";
import { timingSafeEqual } from "@/land/webhooks/signature";

const INTERNAL_SECRET = process.env.INTERNAL_SECRET || process.env.X_INTERNAL_SECRET || "";

/**
 * Timing-safe internal secret verification.
 * Rejects when INTERNAL_SECRET is not configured (empty) to prevent bypass.
 */
function requireInternal(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret") || "";
  if (!INTERNAL_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!timingSafeEqual(secret, INTERNAL_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

function parsePeriod(fromStr: string, toStr: string) {
  const from = fromStr ? new Date(fromStr) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const to = toStr ? new Date(toStr) : new Date();
  const fromSec = Math.floor(from.getTime() / 1000);
  const toSec = Math.floor(to.getTime() / 1000);
  return { fromSec, toSec, from, to };
}

export async function GET(req: NextRequest) {
  // Layer 1: admin role + recent re-authentication (ASVS V3.5.1)
  const auth = await requireAdminWithRecentAuth(req);
  if (auth instanceof NextResponse) return auth;

  // Layer 2: internal secret (timing-safe, rejects when not configured)
  const unauthorized = requireInternal(req);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "monthly";
  const fromStr = searchParams.get("from") || "";
  const toStr = searchParams.get("to") || "";
  const { fromSec, toSec, from, to } = parsePeriod(fromStr, toStr);

  const db = getD1Database();

  try {
    // --- Revenue: sum of billing_events (debits = customer payments, credits = refunds) ---
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

    // --- COGS estimate: ~15% of revenue (CF infra + AI APIs) ---
    // In production, this would be replaced by a real cost ingestion pipeline.
    const cogsRatio = 0.15;
    const cogs = Math.round(revenue * cogsRatio);
    const grossProfit = revenue - cogs;

    // --- OpEx estimate: fixed burn + variable ---
    // Seed from environment / config; replace with actual payroll + vendor data later.
    const monthlyBurn = parseInt(process.env.FINANCE_MONTHLY_BURN_USD || "45000", 10);
    const opex = Math.round(monthlyBurn * ((toSec - fromSec) / (30 * 24 * 60 * 60)));

    const net = grossProfit - opex;

    // --- MRR Waterfall (simplified) ---
    // For production, use subscription_events + stripe/customer data.
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
    const mrrEnd = mrrStart + (revenue - opex > 0 ? revenue - opex : 0); // simplified
    const mrrWaterfall = {
      start: mrrStart,
      new: Math.round(revenue * 0.15),
      expansion: Math.round(revenue * 0.05),
      churn: Math.round(mrrStart * 0.03),
      contraction: Math.round(mrrStart * 0.02),
      end: mrrEnd,
    };

    // --- Key Metrics ---
    const activeCustomers = txCount > 0 ? Math.max(1, Math.round(txCount / 3)) : 1; // rough estimate
    const arpu = activeCustomers > 0 ? Math.round(revenue / activeCustomers) : 0;
    const churnRate = 0.035; // placeholder — replace with actual cohort analysis
    const ltv = arpu > 0 ? Math.round(arpu / churnRate) : 0;
    const cac = parseInt(process.env.FINANCE_CAC_USD || "140", 10);
    const ltvCac = cac > 0 ? Math.round(ltv / cac * 10) / 10 : 0;

    const result = {
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

    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, max-age=300" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "report_failed", message }, { status: 500 });
  }
}
