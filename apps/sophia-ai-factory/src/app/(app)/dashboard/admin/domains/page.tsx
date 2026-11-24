import { BrandDomainsConsole } from './brand-domains-console';

export const dynamic = 'force-dynamic';

export default function AdminDomainsPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <BrandDomainsConsole />
    </main>
  );
}
