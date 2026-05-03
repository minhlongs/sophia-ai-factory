/**
 * Admin redemptions detail page for a specific promo code.
 * /dashboard/admin/promo-codes/[id]/redemptions
 */

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/better-auth-session";
import { listRedemptionsByCode, getCodeByCode } from "@/lib/promo/promo-repo";
import { getD1Raw } from "@/lib/db/client";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock, XCircle } from "lucide-react";

export const dynamic = "force-dynamic";

async function getCodeById(id: string) {
  try {
    const db = await getD1Raw();
    return await db
      .prepare(`SELECT * FROM promo_codes WHERE id = ?1 LIMIT 1`)
      .bind(id)
      .first<{ code: string; description: string | null; used_count: number; max_uses: number | null }>();
  } catch {
    return null;
  }
}

function statusIcon(status: string) {
  switch (status) {
    case "redeemed": return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
    case "reserved": return <Clock className="h-4 w-4 text-amber-400" />;
    default: return <XCircle className="h-4 w-4 text-red-400" />;
  }
}

interface Props {
  params: Promise<{ id: string; locale: string }>;
}

export default async function RedemptionsPage({ params }: Props) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/dashboard");

  const { id } = await params;
  const [codeRow, redemptions] = await Promise.all([
    getCodeById(id),
    listRedemptionsByCode(id, 100),
  ]);

  if (!codeRow) redirect("/dashboard/admin/promo-codes");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="../promo-codes" className="text-zinc-500 hover:text-white transition">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white font-mono">{codeRow.code}</h1>
          {codeRow.description && (
            <p className="text-sm text-zinc-400">{codeRow.description}</p>
          )}
        </div>
        <span className="ml-auto text-sm text-zinc-400">
          {codeRow.used_count}{codeRow.max_uses !== null ? ` / ${codeRow.max_uses}` : ""} uses
        </span>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs text-zinc-500 uppercase tracking-wider">
                <th className="px-4 py-3">User / Email</th>
                <th className="px-4 py-3">Tier / SKU</th>
                <th className="px-4 py-3">Discount</th>
                <th className="px-4 py-3">Trial Days</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Redeemed At</th>
                <th className="px-4 py-3">Handover</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {redemptions.map((r) => (
                <tr key={r.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <p className="text-xs text-zinc-500 font-mono">{r.user_id.slice(0, 8)}...</p>
                    {r.email && <p className="text-xs text-zinc-400">{r.email}</p>}
                  </td>
                  <td className="px-4 py-3 text-zinc-300 text-xs">{r.applied_to_tier ?? r.applied_to_sku ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-300">
                    {r.discount_applied_cents > 0
                      ? `$${(r.discount_applied_cents / 100).toFixed(2)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{r.trial_days_granted > 0 ? `${r.trial_days_granted}d` : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {statusIcon(r.status)}
                      <span className="text-xs text-zinc-300">{r.status}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400">
                    {new Date(r.redeemed_at * 1000).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500 font-mono">
                    {r.handover_id ? r.handover_id.slice(0, 8) + "..." : "—"}
                  </td>
                </tr>
              ))}
              {redemptions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                    No redemptions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
