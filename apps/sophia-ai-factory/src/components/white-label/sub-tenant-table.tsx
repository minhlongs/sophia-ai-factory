'use client'
import type { SubTenantRow } from '@/seed/db/repositories/sub-tenant-repo'

interface SubTenantTableProps {
  subTenants: SubTenantRow[]
  onAdd: () => void
  onRemove: (id: number) => void
}

const badgeMap: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  suspended: 'bg-amber-100 text-amber-700 border-amber-200',
}

export function SubTenantTable({ subTenants, onAdd, onRemove }: SubTenantTableProps) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-semibold">Sub-Tenants</h2>
        <button onClick={onAdd} className="text-sm px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90">+ Add</button>
      </div>
      {subTenants.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground text-center">No sub-tenants yet.</p>
      ) : (
        <table className="w-full text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="px-4 py-2 font-medium">ID</th><th className="px-4 py-2 font-medium">Name</th><th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium text-right">Action</th></tr></thead><tbody>
          {subTenants.map((st) => (
            <tr key={st.id} className="border-b last:border-0">
              <td className="px-4 py-2">{st.id}</td>
              <td className="px-4 py-2">{st.display_name ?? `User #${st.owner_user_id}`}</td>
              <td className="px-4 py-2"><span className={`inline-block px-2 py-0.5 rounded-full text-xs border ${badgeMap[st.status]}`}>{st.status}</span></td>
              <td className="px-4 py-2 text-right">{st.status === 'active' && <button onClick={() => onRemove(st.id)} className="text-xs text-red-600 hover:underline">Remove</button>}</td>
            </tr>
          ))}
        </tbody></table>
      )}
    </div>
  )
}
