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
import { z } from "zod";
import { getD1 } from "@/seed/db/client";
import { errorResponse, handleThrownError } from "@/seed/api";
import { listPublishedListings } from "@/tree/sop/sop-repo-marketplace";
import { fetchAuthorBrandings } from "@/tree/branding/org-branding-repo";

export const dynamic = "force-dynamic";

type Template = Record<string, unknown>;

const MarketplaceParams = z.object({
  category: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.enum(["popular", "rating", "newest"]).default("newest"),
});

export async function GET(request: NextRequest) {
  try {
    const _db = await getD1();
    if (!_db) throw new Error("D1 binding not available");
    const db = _db;
    const { searchParams } = new URL(request.url);
    const parsed = MarketplaceParams.safeParse({
      category: searchParams.get("category") || undefined,
      limit: searchParams.get("limit") || "50",
      offset: searchParams.get("offset") || "0",
      sort: searchParams.get("sort") || "newest",
    });
    if (!parsed.success) {
      return errorResponse("Invalid query parameters", "VALIDATION_ERROR", 400);
    }
    const { category, limit, offset, sort } = parsed.data;

    const rows = await listPublishedListings(db, { category, limit, offset });

    // Batch fetch branding for all unique authors
    const authorIds = [...new Set(rows.map(r => r.author_user_id).filter((id): id is string => !!id))];
    const authorBrandings = await fetchAuthorBrandings(db, authorIds);

    const templates: Template[] = rows.map((r) => ({
      id: r.id,
      templateId: r.template_id,
      name: r.name_en,
      category: r.category,
      priceCents: r.price_cents,
      tags: r.tags ? JSON.parse(r.tags as string) : [],
      totalSales: r.total_sales,
      totalRevenueCents: r.total_revenue_cents,
      ratingAvg: r.rating_avg,
      ratingCount: r.rating_count,
      status: r.status,
      publishedAt: r.published_at,
      previewMd: r.preview_md,
      demoVideoUrl: r.demo_video_url,
      authorUserId: r.author_user_id,
      authorBrandName: r.author_user_id ? authorBrandings.get(r.author_user_id)?.agencyName ?? null : null,
      authorLogoUrl: r.author_user_id ? authorBrandings.get(r.author_user_id)?.logoUrl ?? null : null,
    }));

    // Sort client-side based on available data
    let sorted = templates;
    if (sort === "popular")
      sorted = [...templates].sort(
        (a, b) => (b.totalSales as number) - (a.totalSales as number),
      );
    else if (sort === "rating")
      sorted = [...templates].sort(
        (a, b) => (b.ratingAvg as number) - (a.ratingAvg as number),
      );
    else
      sorted = [...templates].sort((a, b) =>
        (b.publishedAt as string).localeCompare(a.publishedAt as string),
      );

    return NextResponse.json({
      templates: sorted,
      count: sorted.length,
      category,
      sort,
    });
  } catch (err) {
    return handleThrownError(err, "Failed to load marketplace", "MARKETPLACE_FAILED");
  }
}
