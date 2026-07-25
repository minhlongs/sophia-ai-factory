import { createServerClient } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

type SubAccount = { id: string; email: string; role: string; orgId: string };

export default async function SubAccountsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const db = createServerClient();
  const { results } = await db.prepare(
    `SELECT om.id, u.email, om.role, om.org_id
     FROM org_members om
     JOIN users u ON u.id = om.user_id
     WHERE om.org_id IN (
       SELECT org_id FROM org_members WHERE user_id = ?1
     )
     AND om.user_id != ?1
     ORDER BY u.email ASC`
  )
    .bind(user.id)
    .all<SubAccount>();

  const subAccounts = results ?? [];

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-4">
      <h1 className="text-2xl font-bold">Sub-Accounts</h1>
      <p className="text-gray-600">
        Invite and manage agency client sub-accounts. MASTER tier required for agency view.
      </p>

      <div className="overflow-x-auto rounded border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-left">Role</th>
              <th className="p-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {subAccounts.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-6 text-center text-gray-500">
                  No sub-accounts yet. Use the Invite button to add agency clients.
                </td>
              </tr>
            ) : (
              subAccounts.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="p-3">{row.email}</td>
                  <td className="p-3 capitalize">{row.role}</td>
                  <td className="p-3 text-green-700">Active</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
