/**
 * /affiliate-portal — Tax documentation tab.
 *
 * Server Component. Reads the current partner's tax fields straight from
 * `affiliate_partners` and renders the tax tab.
 *
 * The tax columns are queried directly rather than through the partner facade
 * because they were added by a later migration and are not part of the
 * `AffiliatePartner` domain object; re-shaping that object is out of scope here.
 *
 * Privacy boundary: only `tax_form_type`, `tax_form_status` and `tax_country`
 * are selected. No tax identifier, passport or address column is read, and none
 * is stored or displayed anywhere on this surface.
 *
 * @module app/(app)/affiliate-portal/tab-tax-documents
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { AffiliateTaxTab } from '@/components/stitch/screens/affiliate-portal/affiliate-portal-tax-tab';
import type { TaxFormStatus } from '@/land/affiliates/tax-status-presentation';

export const dynamic = 'force-dynamic';

/** Only the three non-sensitive tax columns are ever selected. */
interface PartnerTaxRow {
  tax_form_type: string;
  tax_form_status: TaxFormStatus;
  tax_country: string;
}

/** Copy for a visitor who is not yet an affiliate partner. Always bilingual. */
const NO_PARTNER_COPY = {
  en: 'You need to become an affiliate partner before tax documentation applies.',
  vi: 'Bạn cần trở thành đối tác trước khi cần nộp hồ sơ thuế.',
};

export default async function AffiliateTaxDocumentsTab() {
  const user = await getCurrentUser();
  if (!user?.id) return null;

  const db = await getD1();

  const row = db
    ? await db
        .prepare(
          `SELECT tax_form_type, tax_form_status, tax_country
             FROM affiliate_partners
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 1`,
        )
        .bind(user.id)
        .first<PartnerTaxRow>()
        .catch(() => null)
    : null;

  if (!row) {
    return (
      <div className="rounded-xl border border-outline-variant p-md">
        <p className="font-label-md text-on-surface">{NO_PARTNER_COPY.en}</p>
        <p className="text-sm text-on-surface-variant">{NO_PARTNER_COPY.vi}</p>
      </div>
    );
  }

  return (
    <AffiliateTaxTab
      data={{
        formType: row.tax_form_type,
        status: row.tax_form_status,
        country: row.tax_country,
      }}
    />
  );
}
