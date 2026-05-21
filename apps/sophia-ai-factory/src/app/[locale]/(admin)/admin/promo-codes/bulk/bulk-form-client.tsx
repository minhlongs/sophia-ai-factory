"use client";

/**
 * Orchestrator for the bulk promo code generator.
 * Manages state and API call; delegates UI to BulkRequestForm + BulkResultPanel.
 */

import { useState, useMemo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { BulkRequestForm, MIN_COUNT, MAX_COUNT } from "./bulk-request-form";
import { BulkResultPanel } from "./bulk-result-panel";
import { useReauth } from "@/components/admin/ReauthModal";

interface BulkResult {
  codes: string[];
  promoCodeIds: string[];
  csv: string;
  batchId: string;
  generatedAt: number;
}

export function BulkFormClient() {
  const t = useTranslations("admin.promoCodes.bulk");
  const [count, setCount] = useState<number>(10);
  const [description, setDescription] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkResult | null>(null);
  const { confirmed, ReauthModalElement } = useReauth();

  /**
   * Convert a YYYY-MM-DD date string (from the date picker) to a Unix timestamp
   * representing end-of-day in Asia/Ho_Chi_Minh (GMT+7).
   *
   * The date input returns local-calendar midnight in UTC (e.g. "2026-12-31" →
   * 2026-12-31T00:00:00Z), but VN admin expects the code to expire at the very
   * end of that calendar day in Vietnam local time (23:59:59 GMT+7 =
   * 2026-12-31T16:59:59Z). We therefore subtract 7 hours from UTC midnight and
   * add 23h 59m 59s to get the correct expiry second.
   */
  const validUntilUnix = useMemo(() => {
    if (!expiresAt) return undefined;
    const [y, m, d] = expiresAt.split("-").map(Number);
    if (!y || !m || !d) return undefined;
    // VN is UTC+7; end-of-day local (23:59:59 GMT+7) = same date 16:59:59 UTC.
    const utcMs = Date.UTC(y, m - 1, d, 23 - 7, 59, 59);
    return Math.floor(utcMs / 1000);
  }, [expiresAt]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // ASVS V3.5.1: require re-authentication before destructive admin action.
    const ok = await confirmed();
    if (!ok) return;

    setLoading(true);
    setResult(null);
    try {
      const resp = await fetch("/api/admin/promo-codes/bulk-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseCode: "FREE100",
          tier: "MASTER",
          count,
          description: description || undefined,
          validUntil: validUntilUnix,
        }),
      });
      if (!resp.ok) {
        if (resp.status === 401 || resp.status === 403) throw new Error(t("errorAuth"));
        if (resp.status === 429) throw new Error(t("errorRateLimit"));
        const body = (await resp.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || t("errorGeneric"));
      }
      const data = (await resp.json()) as BulkResult;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setResult(null);
    setError(null);
    setDescription("");
    setExpiresAt("");
    setCount(10);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {ReauthModalElement}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/promo-codes"
            className="text-sm text-zinc-400 hover:text-white inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("backToList")}
          </Link>
          <h1 className="text-2xl font-bold text-white mt-2">{t("pageTitle")}</h1>
          <p className="text-sm text-zinc-400 mt-1">{t("pageSubtitle")}</p>
        </div>
      </div>

      {!result && (
        <BulkRequestForm
          count={count}
          description={description}
          expiresAt={expiresAt}
          loading={loading}
          error={error}
          onCountChange={setCount}
          onDescriptionChange={setDescription}
          onExpiresAtChange={setExpiresAt}
          onSubmit={handleSubmit}
        />
      )}

      {result && <BulkResultPanel result={result} onReset={reset} />}
    </div>
  );
}

export { MIN_COUNT, MAX_COUNT };
