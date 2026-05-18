"use client";

/**
 * Promo codes data table — rows, copy, toggle, redemptions link.
 * Pagination controls included (Prev / Next / page N of M).
 */

import { CheckCircle2, XCircle, Copy, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { PromoCodeRow, DiscountType } from "@/land/promo/promo-types";

function discountLabel(code: PromoCodeRow): string {
  switch (code.discount_type as DiscountType) {
    case "percent_off": return `${code.discount_value}% off`;
    case "fixed_off": return `$${(code.discount_value / 100).toFixed(2)} off`;
    case "free_trial": return `${code.discount_value}-day trial`;
    case "free_full": return "Full free";
    default: return String(code.discount_type);
  }
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    disabled: "bg-zinc-700/50 text-zinc-400 border-zinc-700",
    expired: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${map[status] ?? map.disabled}`}
    >
      {status}
    </span>
  );
}

const PAGE_SIZE = 50;

interface PromoCodesTableProps {
  rows: PromoCodeRow[];
  toggling: string | null;
  copied: string | null;
  page: number;
  totalPages: number;
  onToggle: (code: PromoCodeRow) => void;
  onCopy: (code: string) => void;
  onPageChange: (page: number) => void;
}

export function PromoCodesTable({
  rows,
  toggling,
  copied,
  page,
  totalPages,
  onToggle,
  onCopy,
  onPageChange,
}: PromoCodesTableProps) {
  const t = useTranslations("admin.promoCodes.list");

  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] backdrop-blur-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs text-zinc-500 uppercase tracking-wider">
              <th className="px-4 py-3">{t("columnCode")}</th>
              <th className="px-4 py-3">Discount</th>
              <th className="px-4 py-3">{t("columnTier")}</th>
              <th className="px-4 py-3">{t("columnUsed")}</th>
              <th className="px-4 py-3">{t("columnExpires")}</th>
              <th className="px-4 py-3">{t("columnStatus")}</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {pageRows.map((code) => (
              <tr key={code.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-white">{code.code}</span>
                    <button
                      onClick={() => onCopy(code.code)}
                      title="Copy code"
                      className="text-zinc-600 hover:text-zinc-300 transition"
                    >
                      {copied === code.code ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
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
                  {code.used_count}
                  {code.max_uses !== null ? ` / ${code.max_uses}` : ""}
                </td>
                <td className="px-4 py-3 text-xs text-zinc-400">
                  {code.valid_until
                    ? new Date(code.valid_until * 1000).toLocaleDateString()
                    : t("neverExpires")}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={code.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onToggle(code)}
                      disabled={toggling === code.id || code.status === "expired"}
                      title={code.status === "active" ? "Disable" : "Enable"}
                      className="text-zinc-500 hover:text-zinc-200 transition disabled:opacity-40"
                    >
                      {code.status === "active" ? (
                        <XCircle className="h-4 w-4 text-red-400" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      )}
                    </button>
                    <Link
                      href={`/admin/promo-codes/${code.id}/redemptions`}
                      title="View redemptions"
                      className="text-zinc-500 hover:text-zinc-200 transition"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                  {t("noResults")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/10 text-sm text-zinc-400">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1 rounded border border-white/10 hover:bg-white/5 transition disabled:opacity-40"
          >
            {t("prev")}
          </button>
          <span>
            {t("pageLabel")} {page} {t("pageOf")} {totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1 rounded border border-white/10 hover:bg-white/5 transition disabled:opacity-40"
          >
            {t("next")}
          </button>
        </div>
      )}
    </div>
  );
}

export { PAGE_SIZE };
