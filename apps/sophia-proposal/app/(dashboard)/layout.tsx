/**
 * (dashboard) Route Group Layout — Sidebar nav with auth guard.
 * Auth: redirect to /login if auth-token missing.
 * Org guard: redirect to /onboarding if user has no organization.
 */

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';

const navItems = [
  { href: '/dashboard',              label: 'Overview',  icon: 'home' },
  { href: '/missions',               label: 'Missions',  icon: 'rocket_launch' },
  { href: '/proposals',              label: 'Proposals', icon: 'description' },
  { href: '/settings/api-keys',      label: 'API Keys',  icon: 'key' },
  { href: '/usage',                  label: 'Usage',     icon: 'bar_chart' },
  { href: '/billing',                label: 'Billing',   icon: 'credit_card' },
  { href: '/settings',               label: 'Settings',  icon: 'settings' },
  { href: '/health',                 label: 'Health',    icon: 'monitor_heart' },
];

export default async function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const hasAuth = cookieStore.has('auth-token');
  if (!hasAuth) redirect('/login');

  // Org guard: verify user has an organization via JWT payload
  const token = cookieStore.get('auth-token')?.value;
  if (token) {
    try {
      const { verifyJwt } = await import('@/lib/db/auth-verify');
      const payload = await verifyJwt(token);
      if (payload?.sub) {
        const { getUserOrganization } = await import('@/lib/db/auth');
        const org = await getUserOrganization(payload.sub as string);
        if (!org) redirect('/onboarding');
      }
    } catch {
      // JWT invalid — redirect to login
      redirect('/login');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        {/* Brand */}
        <div className="h-16 flex items-center gap-2 px-4 border-b border-gray-200">
          <div className="w-7 h-7 bg-indigo-600 rounded-md flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-sm">smart_toy</span>
          </div>
          <span className="text-sm font-semibold text-gray-900">Sophia</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navItems.map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              <span className="material-symbols-outlined text-base text-gray-500">{icon}</span>
              {label}
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-gray-200">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Main dashboard
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
