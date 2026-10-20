import AffiliatePortalPage from '@/components/stitch/screens/affiliate-portal/affiliate-portal-page';
import AffiliateTaxDocumentsTab from './tab-tax-documents';

export const dynamic = 'force-dynamic';

export default function AffiliatePortalRoute() {
  return (
    <>
      <AffiliatePortalPage />
      {/* Tax documentation is a server-rendered panel: it reads the partner's
          tax status from D1 and renders below the portal body. Kept separate
          from the client page because the dashboard around it is static mock
          data while this panel is real per-partner state. */}
      <div className="max-w-5xl mx-auto px-lg pb-xl">
        <AffiliateTaxDocumentsTab />
      </div>
    </>
  );
}
