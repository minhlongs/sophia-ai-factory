"use client";

/**
 * Admin promo codes client — orchestrates list state, filters, CSV export.
 * Sub-components: PromoCodesFilterBar, PromoCodesTable, CreatePromoModal.
 */

import { useState, useMemo, useTransition } from "react";
import { Tag, Plus, Download } from "lucide-react";
import { useTranslations } from "next-intl";
import type { PromoCodeRow } from "@/land/promo/promo-types";
import { CreatePromoModal } from "./create-promo-modal";
import { PromoCodesFilterBar, type PromoStatusFilter, type PromoTierFilter } from "./promo-codes-filter-bar";
import { PromoCodesTable, PAGE_SIZE } from "./promo-codes-table";
import { exportPromoCodesCsvAction } from "./csv-export-action";

interface PromoCodesClientProps {
  initialCodes: PromoCodeRow[];
}

export function PromoCodesClient({ initialCodes }: PromoCodesClientProps) {
  const t = useTranslations("admin.promoCodes.list");

  const [codes, setCodes] = useState<PromoCodeRow[]>(initialCodes);
  const [showCreate, setShowCreate] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PromoStatusFilter>("all");
  const [tierFilter, setTierFilter] = useState<PromoTierFilter>("all");
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();

  // Client-side filter
  const filtered = useMemo(() => {
    return codes.filter((c) => {
      if (search && !c.code.toUpperCase().includes(search.toUpperCase())) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      // Tier filter matches server semantic (`promo-repo.listAdminCodes` SQL:
      // `applies_to_tier = ? OR applies_to_tier IS NULL`). Universal codes
      // (null tier) are included when filtering by specific tier so the
      // client table stays in sync with the CSV export Server Action.
      if (
        tierFilter !== "all" &&
        c.applies_to_tier !== tierFilter &&
        c.applies_to_tier !== null
      ) return false;
      return true;
    });
  }, [codes, search, statusFilter, tierFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  // Reset to page 1 on filter change
  function handleSearch(v: string) { setSearch(v); setPage(1); }
  function handleStatus(v: PromoStatusFilter) { setStatusFilter(v); setPage(1); }
  function handleTier(v: PromoTierFilter) { setTierFilter(v); setPage(1); }

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

  const handleExportCsv = () => {
    startTransition(async () => {
      const { csv, count } = await exportPromoCodesCsvAction({
        status: statusFilter !== "all" ? statusFilter : undefined,
        appliesToTier: tierFilter !== "all" ? tierFilter : undefined,
        codePrefix: search || undefined,
      });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `promo-codes-${count}-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  };

  return (
    <>
      <div className="space-y-3">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Tag className="h-4 w-4" />
            <span>{t("resultsCount", { count: filtered.length })}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 transition disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {isPending ? t("exporting") : t("exportCsv")}
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-violet-500 transition"
            >
              <Plus className="h-4 w-4" />
              New Code
            </button>
          </div>
        </div>

        {/* Filters */}
        <PromoCodesFilterBar
          search={search}
          status={statusFilter}
          tier={tierFilter}
          resultsCount={filtered.length}
          onSearch={handleSearch}
          onStatus={handleStatus}
          onTier={handleTier}
        />

        {/* Table */}
        <PromoCodesTable
          rows={filtered}
          toggling={toggling}
          copied={copied}
          page={page}
          totalPages={totalPages}
          onToggle={handleToggle}
          onCopy={handleCopy}
          onPageChange={setPage}
        />
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
