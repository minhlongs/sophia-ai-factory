'use client';

/**
 * Dashboard Layout — Sidebar nav with auth guard.
 * Desktop: persistent sidebar. Mobile: hamburger + slide-in overlay.
 */

import { useState } from 'react';
import Link from 'next/link';

const navItems = [
  { href: '/dashboard/api-keys', label: 'API Keys', icon: 'key' },
  { href: '/dashboard/usage', label: 'Usage', icon: 'bar_chart' },
  { href: '/dashboard/missions', label: 'Missions', icon: 'rocket_launch' },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarContent = (
    <>
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
            onClick={() => setMobileOpen(false)}
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
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700"
        >
          <span className="material-symbols-outlined text-sm">home</span>
          Dashboard home
        </Link>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 bg-white border-r border-gray-200 flex-col">
        {sidebarContent}
      </aside>

      {/* Mobile: hamburger button */}
      <button
        className="md:hidden fixed top-4 left-4 z-40 p-2 rounded-md bg-white border border-gray-200 shadow-sm"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <span className="material-symbols-outlined text-gray-700 text-xl">menu</span>
      </button>

      {/* Mobile: overlay backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile: slide-in sidebar */}
      <aside
        className={`md:hidden fixed top-0 left-0 z-40 h-full w-56 bg-white border-r border-gray-200 flex flex-col transform transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Close button */}
        <button
          className="absolute top-4 right-4"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <span className="material-symbols-outlined text-gray-500 text-xl">close</span>
        </button>
        {sidebarContent}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-6 py-8 pt-16 md:pt-8">
          {children}
        </div>
      </main>
    </div>
  );
}
