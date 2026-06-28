/**
 * SOP Affiliate Link Generation
 * Creates affiliate_links rows for SOP marketplace referrals.
 * Convention: offer_id = 'sop_{templateId}' to distinguish from network offers.
 */

function generateCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  for (const byte of arr) code += chars[byte % chars.length];
  return code;
}

export async function generateSopAffiliateLink(
  db: D1Database,
  userId: string,
  templateId: string,
  tenantId = 'default'
): Promise<{ code: string; id: string }> {
  // Check if link already exists
  const existing = await db.prepare(
    `SELECT id, code FROM affiliate_links WHERE user_id = ?1 AND offer_id = ?2 AND tenant_id = ?3 LIMIT 1`
  ).bind(userId, `sop_${templateId}`, tenantId).first<{ id: string; code: string }>();

  if (existing) return existing;

  const id = crypto.randomUUID();
  const code = generateCode();
  const now = Math.floor(Date.now() / 1000);

  await db.prepare(`
    INSERT INTO affiliate_links (id, tenant_id, offer_id, user_id, code, campaign_name, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
  `).bind(id, tenantId, `sop_${templateId}`, userId, code, `sop-referral`, now).run();

  return { code, id };
}

export async function getSopAffiliateLink(
  db: D1Database,
  userId: string,
  templateId: string,
  tenantId = 'default'
): Promise<{ code: string; id: string } | null> {
  const row = await db.prepare(
    `SELECT id, code FROM affiliate_links WHERE user_id = ?1 AND offer_id = ?2 AND tenant_id = ?3 LIMIT 1`
  ).bind(userId, `sop_${templateId}`, tenantId).first<{ id: string; code: string }>();
  return row ?? null;
}

export function buildSopReferralUrl(code: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.agencyos.network';
  return `${appUrl}/ref/${code}`;
}
