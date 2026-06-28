/**
 * `/dashboard/admin/*` layout — synchronous MASTER tier gate.
 *
 * Why this exists:
 *   Calling `requireMasterTier()` inside `page.tsx` works functionally — but
 *   in Next.js App Router, page-level `redirect()` throws AFTER the layout
 *   tree has already streamed. The browser sees HTTP 200 + admin sidebar
 *   chrome → then receives an RSC redirect signal → navigates to
 *   `/dashboard?error=admin_required`. Net: a 100-300ms flash of admin UI
 *   for non-MASTER users before the bounce.
 *
 *   Putting the gate in `layout.tsx` runs it BEFORE the layout HTML streams.
 *   `redirect()` here returns HTTP 307 + Location header immediately — no
 *   flash, no shell, no inconsistent URL state for Playwright.
 *
 *   Sub-pages (api-key-usage, audit-log, cost, crons, etc.) keep their own
 *   `await requireMasterTier()` as defense-in-depth — cheap (~1ms) and
 *   protects against accidental layout misconfiguration in the future.
 */
import { requireMasterTier } from '@/seed/auth/require-master-tier';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  await requireMasterTier();
  return <>{children}</>;
}
