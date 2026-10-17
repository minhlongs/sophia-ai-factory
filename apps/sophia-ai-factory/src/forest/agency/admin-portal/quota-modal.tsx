'use client';

/**
 * Agency Quota Reallocation Modal Dialog
 * Layer: forest/agency (UI components & presentation)
 *
 * @module forest/agency/admin-portal/quota-modal
 */

import React, { useState } from 'react';
import { Zap, X } from 'lucide-react';
import type { AgencyClientSummary } from './types';
import { QuotaModalFields } from './quota-modal-fields';

export { QuotaModalFields, type QuotaModalFieldsProps } from './quota-modal-fields';

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
          : `New quota cannot be lower than currently used MCU (${client!.usedMcu} MCU)`,
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
            : 'Failed to update quota',
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
          <QuotaModalFields
            client={client}
            quota={quota}
            setQuota={setQuota}
            error={error}
            isVi={isVi}
          />

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
