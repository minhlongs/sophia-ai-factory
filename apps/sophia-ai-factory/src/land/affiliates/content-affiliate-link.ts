/**
 * Content-Affiliate Linker
 * Binds generated content to affiliate links for per-content revenue attribution.
 * Layer: land (business workflow).
 * @module affiliates/content-affiliate-link
 */
import { getD1 } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { success, failure, type Result } from '@/seed/types/result'
import { recordROI } from '@/tree/roi/tracker'

export interface ContentAffiliateLink {
  id: string; workspaceId: string; contentProjectId: string; contentAssetId: string | null
  linkId: string; affiliateCode: string; network: string; status: string
  attributionId: string | null; generatedAt: number; createdAt: number
}

const COLS = 'id, workspace_id, content_project_id, content_asset_id, link_id, affiliate_code, network, status, attribution_id, generated_at, created_at'

function toLink(r: Record<string, unknown>): ContentAffiliateLink {
  return {
    id: String(r.id), workspaceId: String(r.workspace_id),
    contentProjectId: String(r.content_project_id),
    contentAssetId: r.content_asset_id == null ? null : String(r.content_asset_id),
    linkId: String(r.link_id), affiliateCode: String(r.affiliate_code),
    network: String(r.network), status: String(r.status),
    attributionId: r.attribution_id == null ? null : String(r.attribution_id),
    generatedAt: Number(r.generated_at), createdAt: Number(r.created_at),
  }
}

export async function linkContentToAffiliate(opts: {
  workspaceId: string; projectId: string; assetId?: string; linkId: string
  affiliateCode?: string; network?: string; attributionId?: string
}): Promise<Result<ContentAffiliateLink, Error>> {
  const db = getD1()
  if (!db) return failure(new Error('D1 database binding not available'))
  const id = `cal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  try {
    const ws = await db.prepare('SELECT 1 FROM org_members WHERE org_id = ? LIMIT 1')
      .bind(opts.workspaceId).first()
    if (!ws) return failure(new Error(`Workspace not found: ${opts.workspaceId}`))
    await db.prepare(
      `INSERT OR IGNORE INTO content_affiliate_links (${COLS})
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      id, opts.workspaceId, opts.projectId, opts.assetId ?? null,
      opts.linkId, opts.affiliateCode ?? '', opts.network ?? 'unknown',
      'active', opts.attributionId ?? null, Date.now(),
    ).run()
    const row = await db.prepare(`SELECT ${COLS} FROM content_affiliate_links WHERE id = ?`)
      .bind(id).first()
    if (!row) return failure(new Error('Failed to persist content-affiliate link'))
    return success(toLink(row))
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    logger.warn('[content-affiliate-link] linkContentToAffiliate failed', { error: error.message })
    return failure(error)
  }
}

export async function getContentAffiliateLinks(opts: {
  workspaceId: string; projectId?: string
}): Promise<Result<ContentAffiliateLink[], Error>> {
  const db = getD1()
  if (!db) return failure(new Error('D1 database binding not available'))
  const where = opts.projectId
    ? ' WHERE workspace_id = ? AND content_project_id = ? ORDER BY created_at DESC'
    : ' WHERE workspace_id = ? ORDER BY created_at DESC'
  const binds = opts.projectId ? [opts.workspaceId, opts.projectId] : [opts.workspaceId]
  try {
    const rows = await db.prepare(`SELECT ${COLS} FROM content_affiliate_links${where}`)
      .bind(...binds).all()
    return success((rows.results ?? []).map(toLink))
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    logger.warn('[content-affiliate-link] getContentAffiliateLinks failed', { error: error.message })
    return failure(error)
  }
}

export async function trackContentRevenue(opts: {
  workspaceId: string; linkId: string; revenueCents: number; costCents: number; network?: string
}): Promise<Result<void, Error>> {
  if (opts.revenueCents < 0 || opts.costCents < 0) {
    return failure(new Error('revenueCents and costCents must be non-negative'))
  }
  try {
    await recordROI({
      workspaceId: opts.workspaceId, entityType: 'campaign', entityId: opts.linkId,
      revenueCents: opts.revenueCents, costCents: opts.costCents,
      recordedAt: Date.now(),
      channel: opts.network ? `affiliate:${opts.network}` : undefined,
    })
    return success(undefined)
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    logger.warn('[content-affiliate-link] trackContentRevenue failed', { error: error.message })
    return failure(error)
  }
}