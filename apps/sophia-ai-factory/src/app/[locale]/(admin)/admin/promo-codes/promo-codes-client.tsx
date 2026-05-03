"use client";

/**
 * Admin promo codes client component — list + create + status toggle.
 */

import { useState } from "react";
import { Tag, Plus, CheckCircle2, XCircle, Copy, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { PromoCodeRow, DiscountType } from "@/lib/promo/promo-types";
import { CreatePromoModal } from "./create-promo-modal";

interface PromoCodesClientProps {
  initialCodes: PromoCodeRow[];
}

function discountLabel(code: PromoCodeRow): string {
  switch (code.discount_type) {
    case "percent_off": return `${code.discount_value}% off`;
    case "fixed_off": return `$${(code.discount_value / 100).toFixed(2)} off`;
    case "free_trial": return `${code.discount_value}-day trial`;
    case "free_full": return "Full free";
    default: return String(code.discount_type);
  }
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    disabled: "bg-zinc-700/50 text-zinc-400 border-zinc-700",
    expired: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${map[status] ?? map.disabled}`}>
      {status}
    </span>
  );
}

export function PromoCodesClient({ initialCodes }: PromoCodesClientProps) {
  const [codes, setCodes] = useState<PromoCodeRow[]>(initialCodes);
  const [showCreate, setShowCreate] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const handleToggle = async (code: PromoCodeRow) => {
    const newStatus = code.status === "active" ? "disabled" : "active";
    setToggling(code.id);
    try {
      const res = await fetch(`/api/admin/promo-codes/${code.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setCodes((prev) => prev.map((c) => c.id === code.id ? { ...c, status: newStatus } : c));
      }
    } finally {
      setToggling(null);
    }
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 1500);
  };

  const handleCreated = (newCode: PromoCodeRow) => {
    setCodes((prev) => [newCode, ...prev]);
    setShowCreate(false);
  };

  return (
    <>
      <div className="rounded-xl border border-white/10 bg-white/[0.02] backdrop-blur-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Tag className="h-4 w-4" />
            <span>{codes.length} codes</span>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-violet-500 transition"
          >
            <Plus className="h-4 w-4" />
            New Code
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs text-zinc-500 uppercase tracking-wider">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Discount</th>
                <th className="px-4 py-3">Tier/SKU</th>
                <th className="px-4 py-3">Uses</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {codes.map((code) => (
                <tr key={code.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-white">{code.code}</span>
                      <button
                        onClick={() => handleCopy(code.code)}
                        title="Copy code"
                        className="text-zinc-600 hover:text-zinc-300 transition"
                      >
                        {copied === code.code
                          ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                          : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    {code.description && (
                      <p className="text-xs text-zinc-500 mt-0.5">{code.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{discountLabel(code)}</td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">
                    {code.applies_to_tier ?? code.applies_to_sku ?? "All"}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    {code.used_count}{code.max_uses !== null ? ` / ${code.max_uses}` : ""}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400">
                    {code.valid_until
                      ? new Date(code.valid_until * 1000).toLocaleDateString()
                      : "Never"}
                  </td>
                  <td className="px-4 py-3">{statusBadge(code.status)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggle(code)}
                        disabled={toggling === code.id || code.status === "expired"}
                        title={code.status === "active" ? "Disable" : "Enable"}
                        className="text-zinc-500 hover:text-zinc-200 transition disabled:opacity-40"
                      >
                        {code.status === "active"
                          ? <XCircle className="h-4 w-4 text-red-400" />
                          : <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                      </button>
                      <Link
                        href={`admin/promo-codes/${code.id}/redemptions`}
                        title="View redemptions"
                        className="text-zinc-500 hover:text-zinc-200 transition"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {codes.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                    No promo codes yet. Create one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <CreatePromoModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  );
}
