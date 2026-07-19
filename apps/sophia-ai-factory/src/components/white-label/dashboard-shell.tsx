'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Users, Palette, Settings } from 'lucide-react'
import type { AgencyBranding } from '@/seed/config/agency-branding'

interface DashboardShellProps {
  branding: AgencyBranding
  agencyId: number
  children: React.ReactNode
}

const navLinks = [
  { href: '/agency/dashboard', icon: Home, label: 'Dashboard' },
  { href: '/agency/settings/branding', icon: Palette, label: 'Branding' },
]

export function DashboardShell({ branding, agencyId, children }: DashboardShellProps) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen" style={{ '--agency-primary': branding.primaryColor, '--agency-secondary': branding.secondaryColor } as React.CSSProperties}>
      <div className="flex min-h-screen">
        <aside className="hidden md:flex md:w-56 md:flex-col md:fixed md:inset-y-0 border-r bg-card">
          <div className="h-14 flex items-center px-4 border-b font-semibold text-lg" style={{ color: branding.primaryColor }}>
            {branding.logoUrl ? <img src={branding.logoUrl} alt={branding.displayName} className="h-8 mr-2" /> : <span>{branding.displayName}</span>}
          </div>
          <nav className="flex-1 p-3 space-y-1">
            {navLinks.map((link) => {
              const active = pathname?.startsWith(link.href) ?? false
              return (
                <Link key={link.href} href={`/[locale]${link.href}` as never} className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${active ? 'font-medium' : 'text-muted-foreground hover:bg-muted'}`} style={active ? { color: branding.primaryColor } : undefined}>
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </Link>
              )
            })}
          </nav>
          <div className="p-3 border-t text-xs text-muted-foreground">Agency #{agencyId}</div>
        </aside>
        <main className="flex-1 md:ml-56">
          <div className="max-w-5xl mx-auto p-4 md:p-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
