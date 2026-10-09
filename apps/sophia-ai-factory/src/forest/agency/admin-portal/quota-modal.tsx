/**
 * Agency Quota Reallocation Modal Dialog
 * Layer: forest/agency (UI components & presentation)
 *
 * @module forest/agency/admin-portal/quota-modal
 */

import React, { useState } from 'react';
import { Zap, X, AlertCircle } from 'lucide-react';
import type { AgencyClientSummary } from './types';

export interface QuotaModalProps {
  client: AgencyClientSummary | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (subaccountId: string, newQuota: number) => Promise<void>;
  isVi: boolean;
}

export function QuotaModal({
  client,
  isOpen,
  onClose,
  onSave,
  isVi,
}: QuotaModalProps) {
  const [quota, setQuota] = useState<number>(client?.allocatedMcu || 100);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state when client changes
  React.useEffect(() => {
    if (client) {
      setQuota(client.allocatedMcu);
      setError(null);
    }
  }, [client]);

  if (!isOpen || !client) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (quota < client!.usedMcu) {
      setError(
        isVi
          ? `Hạn mức mới không được thấp hơn lượng MCU đã dùng (${client!.usedMcu} MCU)`
          : `New quota cannot be lower than currently used MCU (${client!.usedMcu} MCU)`
      );
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSave(client!.id, quota);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isVi
          ? 'Không thể cập nhật hạn mức'
          : 'Failed to update quota'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in-0">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2 text-foreground font-semibold">
            <Zap className="w-5 h-5 text-amber-500" />
            <h3>{isVi ? 'Phân Bổ Lại Điểm MCU' : 'Reallocate MCU Quota'}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">
              {isVi ? 'Khách Hàng' : 'Client Workspace'}
            </label>
            <p className="text-sm font-bold text-foreground">
              {client.name}
            </p>
            <p className="text-xs text-muted-foreground font-mono">
              {client.id}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-xl border border-border/50 text-xs">
            <div>
              <span className="text-muted-foreground">
                {isVi ? 'Đã sử dụng:' : 'Currently Used:'}
              </span>
              <p className="font-bold text-foreground font-mono text-sm mt-0.5">
                {client.usedMcu} MCU
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">
                {isVi ? 'Hạn mức cũ:' : 'Current Quota:'}
              </span>
              <p className="font-bold text-foreground font-mono text-sm mt-0.5">
                {client.allocatedMcu} MCU
              </p>
            </div>
          </div>

          <div>
            <label
              htmlFor="quota-input"
              className="text-xs font-semibold text-muted-foreground block mb-1"
            >
              {isVi ? 'Hạn Mức MCU Mới' : 'New MCU Quota'}
            </label>
            <input
              id="quota-input"
              type="number"
              min={client.usedMcu}
              step={10}
              value={quota}
              onChange={(e) => setQuota(Number(e.target.value))}
              className="w-full px-3.5 py-2 rounded-xl bg-background border border-border text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              required
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              {isVi
                ? 'Đơn vị tính: 1 MCU = 1 lượt render video 60s độ phân giải cao'
                : '1 MCU = 1 standard 60s high-definition video render unit'}
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-500/10 text-rose-500 rounded-xl text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              {isVi ? 'Hủy' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
            >
              {isSubmitting
                ? isVi
                  ? 'Đang lưu...'
                  : 'Saving...'
                : isVi
                ? 'Cập Nhật Hạn Mức'
                : 'Update Quota'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
