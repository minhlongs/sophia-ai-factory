"use client";

import { useState } from "react";
import { Download, FileJson, FileSpreadsheet, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportCampaigns, ExportFormat } from "@/app/actions/campaign-export-actions";
import { useToast } from "@/hooks/use-toast";

export function CampaignExportControl() {
  const [isOpen, setIsOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("all");
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

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
        title: "Export Successful",
        description: `Campaigns exported as ${format.toUpperCase()}`,
      });

      setIsOpen(false); // Close panel after success
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export Failed",
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
        <Download className="w-4 h-4" />
        Export
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-12 z-50 w-80 bg-white rounded-lg border border-gray-200 shadow-xl p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900 flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Export Options
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Status Filter */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="queued">Queued</option>
                <option value="processing_script">Processing Script</option>
                <option value="processing_video">Processing Video</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <FileJson className="w-4 h-4" />
                JSON
              </Button>
              <Button
                variant="outline"
                className="w-full flex items-center justify-center gap-2"
                onClick={() => handleExport("csv")}
                disabled={isExporting}
              >
                <FileSpreadsheet className="w-4 h-4" />
                CSV
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
