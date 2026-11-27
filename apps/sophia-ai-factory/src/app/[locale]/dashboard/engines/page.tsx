import { EngineWorkbench } from '@/components/studio-kit/engine-workbench';

export const dynamic = 'force-dynamic';

export default async function DashboardEnginesPage({
  params,
}: {
  readonly params: Promise<{ readonly locale: string }>;
}) {
  const { locale } = await params;
  const normalizedLocale: 'vi' | 'en' = locale === 'en' ? 'en' : 'vi';
  return (
    <div className="mx-auto max-w-6xl py-2">
      <EngineWorkbench locale={normalizedLocale} />
    </div>
  );
}
