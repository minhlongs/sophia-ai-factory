/**
 * GET /api/sop-marketplace — Public listing of published SOP templates.
 *
 * Query:
 * - category (optional): filter by category
 * - limit (optional, default 50, max 200)
 * - offset (optional, default 0)
 * - sort: popular | rating | newest (default: newest)
 */

import { NextRequest, NextResponse } from "next/server";
import { getD1Raw } from "@/seed/db/client";
import { listPublishedListings } from "@/tree/sop/sop-repo-marketplace";

export const dynamic = "force-dynamic";

type Template = Record<string, unknown>;

export async function GET(request: NextRequest) {
 try {
  const db = await getD1Raw();
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") || undefined;
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50", 10) || 50));
  const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10) || 0);
  const sort = (searchParams.get("sort") || "newest") as "popular" | "rating" | "newest";

  const rows = await listPublishedListings(db, { category, limit, offset });
  const templates: Template[] = rows.map((r) => ({ id: r.id, templateId: r.template_id, name: r.name_en, category: r.category, priceCents: r.price_cents, tags: r.tags ? JSON.parse(r.tags as string) : [], totalSales: r.total_sales, totalRevenueCents: r.total_revenue_cents, ratingAvg: r.rating_avg, ratingCount: r.rating_count, status: r.status, publishedAt: r.published_at, previewMd: r.preview_md, demoVideoUrl: r.demo_video_url, }));

  // Sort client-side based on available data
  let sorted = templates;
  if (sort === "popular") sorted = [...templates].sort((a, b) => (b.totalSales as number) - (a.totalSales as number));
  else if (sort === "rating") sorted = [...templates].sort((a, b) => (b.ratingAvg as number) - (a.ratingAvg as number));
  else sorted = [...templates].sort((a, b) => (b.publishedAt as string).localeCompare(a.publishedAt as string));

  return NextResponse.json({ templates: sorted, count: sorted.length, category, sort });
 } catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  return NextResponse.json({ error: "marketplace_failed", message }, { status: 500 });
 }
}
