import PricingPage from '@/components/stitch/screens/pricing/pricing-page';
import { buildCorePagePayload } from '@/seed/aeo';
import { normalizeAeoLocale } from '@/tree/aeo';
import { DualReadPageSection } from '@/forest/components/aeo';

export const dynamic = 'force-dynamic';

export default async function PricingRoute({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const resolved = params ? await params : {};
  const payload = buildCorePagePayload('pricing', normalizeAeoLocale(resolved.locale));

  return (
    <>
      <PricingPage />
      <DualReadPageSection payload={payload} />
    </>
  );
}
