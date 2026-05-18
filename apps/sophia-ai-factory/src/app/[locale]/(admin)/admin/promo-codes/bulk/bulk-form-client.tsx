"use client";

/**
 * Admin bulk promo generator form. Calls POST /api/admin/promo-codes/bulk-generate
 * and renders the result (codes table + CSV download).
 */

import { useState, useMemo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, Download, Copy, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface BulkResult {
  codes: string[];
  promoCodeIds: string[];
  csv: string;
  batchId: string;
  generatedAt: number;
}

const MIN_COUNT = 1;
const MAX_COUNT = 1000;

export function BulkFormClient() {
  const t = useTranslations("admin.promoCodes.bulk");
  const [count, setCount] = useState<number>(10);
  const [description, setDescription] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [copied, setCopied] = useState(false);

  const validUntilUnix = useMemo(() => {
    if (!expiresAt) return undefined;
    const ms = Date.parse(expiresAt);
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : undefined;
  }, [expiresAt]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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

  function downloadCsv() {
    if (!result) return;
    const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `free100-codes-${result.batchId}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function copyAll() {
    if (!result) return;
    await navigator.clipboard.writeText(result.codes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
        <form
          onSubmit={handleSubmit}
          className="space-y-5 bg-zinc-900/50 border border-zinc-800 rounded-lg p-6"
        >
          <div>
            <label htmlFor="count" className="block text-sm font-medium text-zinc-300 mb-1">
              {t("countLabel")} <span className="text-rose-400">*</span>
            </label>
            <input
              id="count"
              name="count"
              type="number"
              min={MIN_COUNT}
              max={MAX_COUNT}
              required
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
            <p className="text-xs text-zinc-500 mt-1">{t("countHelper")}</p>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-zinc-300 mb-1">
              {t("descriptionLabel")}
            </label>
            <input
              id="description"
              name="description"
              type="text"
              maxLength={200}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("descriptionPlaceholder")}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label htmlFor="expiresAt" className="block text-sm font-medium text-zinc-300 mb-1">
              {t("expiresLabel")}
            </label>
            <input
              id="expiresAt"
              name="expiresAt"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-rose-500/10 border border-rose-500/30 rounded-md text-sm text-rose-300">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <div className="font-medium">{t("errorTitle")}</div>
                <div className="opacity-80">{error}</div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || count < MIN_COUNT || count > MAX_COUNT}
            className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 font-medium rounded-md transition"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? t("submitting") : t("submit")}
          </button>
        </form>
      )}

      {result && (
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-md">
            <CheckCircle2 className="w-5 h-5 mt-0.5 text-emerald-400 shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-medium text-emerald-300">
                {t("successHeading", { count: result.codes.length })}
              </div>
              <div className="text-xs text-zinc-500 mt-1 font-mono">
                batchId: {result.batchId}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={downloadCsv}
              className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-medium rounded-md transition"
            >
              <Download className="w-4 h-4" />
              {t("downloadCsv")}
            </button>
            <button
              onClick={copyAll}
              className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-md transition"
            >
              <Copy className="w-4 h-4" />
              {copied ? t("copied") : t("copyAll")}
            </button>
            <button
              onClick={reset}
              className="ml-auto px-4 py-2 text-sm text-zinc-400 hover:text-white transition"
            >
              {t("reset")}
            </button>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-400">
              {t("codeTable")}
            </div>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm font-mono">
                <tbody>
                  {result.codes.map((code, i) => (
                    <tr key={code} className="border-b border-zinc-800/50">
                      <td className="px-4 py-2 text-zinc-500 w-12">{i + 1}</td>
                      <td className="px-4 py-2 text-white">{code}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
