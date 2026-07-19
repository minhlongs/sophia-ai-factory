/**
 * /dashboard/admin/sop-reviews — Admin review queue for community SOP submissions.
 *
 * Server Component. Lists all SOPs with status = "pending_review" and provides
 * Approve / Reject actions via the client component.
 */

import { requireMasterTier } from '@/seed/auth/require-master-tier';
import { getD1 } from '@/seed/db/client';
import { SopReviewsClient, type PendingSop } from './sop-reviews-client';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function SopReviewsPage({ params }: PageProps): Promise<React.JSX.Element> {
  await params;
  await requireMasterTier();

  const db = getD1();
  let sops: PendingSop[] = [];

  if (db) {
    const rows = await db
      .prepare(
        `SELECT st.id, st.name_vi, st.name_en, st.category, st.created_at,
                st.author_user_id, u.name AS author_name
         FROM sop_templates st
         LEFT JOIN "user" u ON u.id = st.author_user_id
         WHERE st.status = 'pending_review'
         ORDER BY st.created_at DESC`,
      )
      .all<PendingSop>();

    sops = rows.results ?? [];
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">SOP Review Queue</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review and approve community-submitted SOPs before they are published to the marketplace.
        </p>
      </header>
      <SopReviewsClient sops={sops} />
    </div>
  );
}
