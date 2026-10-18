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
 * Access: admin only (requires x-internal-secret or auth middleware).
 */

import { NextRequest, NextResponse } from "next/server";
import { getD1Database } from "@/land/analytics/cohort-calculator";
import { requireAdminWithRecentAuth } from "@/seed/auth/require-admin";
import {
  requireInternal,
  parsePeriod,
  generateFinanceReportData,
} from "./finance-report-helpers";

export async function GET(req: NextRequest) {
  // Layer 1: admin role + recent re-authentication (ASVS V3.5.1)
  const auth = await requireAdminWithRecentAuth(req);
  if (auth instanceof Response) return auth;

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
    const result = await generateFinanceReportData(db, period, fromSec, toSec, from, to);

    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, max-age=300" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "report_failed", message }, { status: 500 });
  }
}
