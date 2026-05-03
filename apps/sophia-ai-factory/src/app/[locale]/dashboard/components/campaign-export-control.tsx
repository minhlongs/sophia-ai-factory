"use client";

import { useState } from "react";
import { Download, FileJson, FileSpreadsheet, Filter, X } from "lucide-react";
import { Button } from "@/seed/components/ui/button";
import { exportCampaigns, ExportFormat } from "@/app/actions/campaign-export-actions";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from 'next-intl';

export function CampaignExportControl() {
  const [isOpen, setIsOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("all");
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();
  const t = useTranslations('dashboard.export');
  const tStatus = useTranslations('campaign.status');

  const handleExport = async (format: ExportFormat) => {
    try {
      setIsExporting(true);

      const result = await exportCampaigns(format, {
        status: status === "all" ? undefined : status,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });

      if (!result.success || !result.data) {
        throw new Error(result.message || "Export failed");
      }

      // Create download
      const blob = new Blob([result.data], { type: result.mimeType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename || `export.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: t('success'),
        description: t('success_desc', { format: format.toUpperCase() }),
      });

      setIsOpen(false); // Close panel after success
    } catch (error) {
      toast({
        title: t('failed'),
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative">
      <Button
        variant="outline"
        className="flex items-center gap-2"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Download className="w-4 h-4" aria-hidden="true" />
        {t('button')}
      </Button>

      {isOpen && (
        <div role="dialog" aria-label={t('title')} className="absolute right-0 top-12 z-50 w-80 bg-popover rounded-lg border border-border shadow-xl p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-popover-foreground flex items-center gap-2">
              <Filter className="w-4 h-4" aria-hidden="true" />
              {t('title')}
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close export options"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Status Filter */}
            <div className="space-y-1.5">
              <label htmlFor="export-status" className="text-sm font-medium text-popover-foreground">{t('status_label')}</label>
              <select
                id="export-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
              >
                <option value="all">{t('all_statuses')}</option>
                <option value="queued">{tStatus('queued')}</option>
                <option value="processing_script">{tStatus('processing_script')}</option>
                <option value="processing_video">{tStatus('processing_video')}</option>
                <option value="completed">{tStatus('completed')}</option>
                <option value="failed">{tStatus('failed')}</option>
              </select>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label htmlFor="export-start-date" className="text-sm font-medium text-popover-foreground">{t('start_date')}</label>
                <input
                  id="export-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="export-end-date" className="text-sm font-medium text-popover-foreground">{t('end_date')}</label>
                <input
                  id="export-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button
                variant="outline"
                className="w-full flex items-center justify-center gap-2"
                onClick={() => handleExport("json")}
                disabled={isExporting}
              >
                <FileJson className="w-4 h-4" aria-hidden="true" />
                JSON
              </Button>
              <Button
                variant="outline"
                className="w-full flex items-center justify-center gap-2"
                onClick={() => handleExport("csv")}
                disabled={isExporting}
              >
                <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
                CSV
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
