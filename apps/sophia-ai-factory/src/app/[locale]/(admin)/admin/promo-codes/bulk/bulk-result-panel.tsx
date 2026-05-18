"use client";

/**
 * Success result panel for bulk code generation.
 * Shows CSV download, copy-all, and generated codes table.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Download, Copy, CheckCircle2 } from "lucide-react";

interface BulkResult {
  codes: string[];
  csv: string;
  batchId: string;
}

interface BulkResultPanelProps {
  result: BulkResult;
  onReset: () => void;
}

export function BulkResultPanel({ result, onReset }: BulkResultPanelProps) {
  const t = useTranslations("admin.promoCodes.bulk");
  const [copied, setCopied] = useState(false);

  function downloadCsv() {
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
    await navigator.clipboard.writeText(result.codes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
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
          onClick={onReset}
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
  );
}
