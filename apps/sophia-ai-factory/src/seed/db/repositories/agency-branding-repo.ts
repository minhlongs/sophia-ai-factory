import { getD1 } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'
import { success, failure, type Result } from '@/seed/types/result'
import type { AgencyBranding } from '@/seed/config/agency-branding'
import { DEFAULT_BRANDING } from '@/seed/config/agency-branding'

export interface AgencyBrandingRow {
  agency_id: number
  primary_color: string
  secondary_color: string
  logo_url: string | null
  custom_domain: string | null
  display_name: string
  tagline_vi: string
  tagline_en: string
  updated_at: number
}

export interface UpdateBrandingInput {
  primaryColor?: string
  secondaryColor?: string
  logoUrl?: string | null
  customDomain?: string | null
  displayName?: string
  taglineVi?: string
  taglineEn?: string
}

function getDb() {
  const _db = getD1()
  if (!_db) throw new Error('D1 binding not available')
  return _db
}

function rowToBranding(row: AgencyBrandingRow): AgencyBranding {
  return {
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    logoUrl: row.logo_url,
    customDomain: row.custom_domain,
    displayName: row.display_name,
    taglineVi: row.tagline_vi,
    taglineEn: row.tagline_en,
  }
}

export async function getBranding(agencyId: number): Promise<AgencyBranding> {
  const db = getDb()
  const result = await db
    .prepare('SELECT * FROM agency_branding WHERE agency_id = ?1')
    .bind(agencyId)
    .first<AgencyBrandingRow>()

  const row = result
  if (!row) return { ...DEFAULT_BRANDING }
  return rowToBranding(row)
}

export async function updateBranding(
  agencyId: number,
  data: UpdateBrandingInput,
): Promise<Result<void>> {
  const db = getDb()
  const now = Math.floor(Date.now() / 1000)

  try {
    const sets: string[] = ['updated_at = ?' + (Object.keys(data).length + 1)]
    const values: (string | null | number)[] = [now]

    let idx = 1
    if (data.primaryColor !== undefined) {
      sets.push(`primary_color = ?${++idx}`)
      values.push(data.primaryColor)
    }
    if (data.secondaryColor !== undefined) {
      sets.push(`secondary_color = ?${++idx}`)
      values.push(data.secondaryColor)
    }
    if (data.logoUrl !== undefined) {
      sets.push(`logo_url = ?${++idx}`)
      values.push(data.logoUrl)
    }
    if (data.customDomain !== undefined) {
      sets.push(`custom_domain = ?${++idx}`)
      values.push(data.customDomain)
    }
    if (data.displayName !== undefined) {
      sets.push(`display_name = ?${++idx}`)
      values.push(data.displayName)
    }
    if (data.taglineVi !== undefined) {
      sets.push(`tagline_vi = ?${++idx}`)
      values.push(data.taglineVi)
    }
    if (data.taglineEn !== undefined) {
      sets.push(`tagline_en = ?${++idx}`)
      values.push(data.taglineEn)
    }

    values.push(agencyId)

    const sql = `UPDATE agency_branding SET ${sets.join(', ')} WHERE agency_id = ?${idx + 1}`

    const runResult = await db.prepare(sql).bind(...values).run()

    if (runResult.error) {
      return failure(new Error(toError(runResult.error).message))
    }

    logger.info('[AgencyBrandingRepo] Updated branding', { agencyId, keys: Object.keys(data) })
    return success(undefined)
  } catch (err) {
    logger.error('[AgencyBrandingRepo] updateBranding threw', toError(err))
    return failure(new Error(toError(err).message))
  }
}
