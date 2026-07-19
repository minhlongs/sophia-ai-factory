'use client';

/**
 * RotationButton — client component for triggering key rotation.
 *
 * Shows a red "Rotate Encryption Keys" button that opens a confirm dialog,
 * then calls POST /api/admin/keys/rotate and displays a toast on result.
 *
 * @module app/[locale]/dashboard/admin/byok-rotation/components/rotation-button
 */

import { useState, useCallback } from 'react';
import { RotateCw, AlertTriangle } from 'lucide-react';

interface RotationButtonProps {
  locale: string;
}

type ToastState = { message: string; type: 'success' | 'error' } | null;

export default function RotationButton({ locale }: RotationButtonProps) {
  const isVi = locale.startsWith('vi');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const dismissToast = useCallback(() => setToast(null), []);

  const handleRotate = useCallback(async () => {
    const confirmed = window.confirm(
      isVi
        ? 'CẢNH BÁO: Hành động này sẽ tạo phiên bản khóa mã hóa mới và mã hóa lại tất cả thông tin đăng nhập đã lưu trữ. Quá trình giải mã hiện tại sẽ tiếp tục hoạt động trong 7 ngày (cửa sổ giải mã kép). Bạn có chắc chắn muốn tiếp tục?'
        : 'WARNING: This will create a new encryption key version and re-encrypt all stored credentials. Existing decryption will continue to work for 7 days (dual-decrypt window). Are you sure you want to proceed?',
    );

    if (!confirmed) return;

    setLoading(true);
    setToast(null);

    try {
      const res = await fetch('/api/admin/keys/rotate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'admin_manual_rotation' }),
      });

      if (!res.ok) {
        const errBody = (await res.json().catch(() => null)) as { error?: string } | null;
        setToast({
          message: errBody?.error
            ? (isVi ? 'Lỗi: ' : 'Error: ') + errBody.error
            : isVi
              ? 'Yêu cầu rotation thất bại'
              : 'Rotation request failed',
          type: 'error',
        });
        return;
      }

      const data = (await res.json()) as {
        message?: string;
        keyVersion?: number;
      };
      setToast({
        message: isVi
          ? `Rotation đã được kích hoạt — công việc mã hóa lại đã được xếp hàng (phiên bản #${data.keyVersion ?? ''})`
          : `Rotation triggered — re-encrypt job queued (version #${data.keyVersion ?? ''})`,
        type: 'success',
      });
    } catch (err) {
      setToast({
        message: isVi
          ? 'Lỗi kết nối: không thể gửi yêu cầu rotation'
          : 'Network error: could not send rotation request',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [isVi]);

  return (
    <section className="space-y-3">
      <div className="rounded-lg border border-red-900/30 bg-red-500/5 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-red-300">
              {isVi ? 'Rotation Khóa Mã Hóa' : 'Encryption Key Rotation'}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {isVi
                ? 'Tạo phiên bản khóa mới và mã hóa lại tất cả thông tin đăng nhập. Thao tác này không thể hoàn tác ngay lập tức.'
                : 'Create a new key version and re-encrypt all stored credentials. This action cannot be immediately undone.'}
            </p>
          </div>
          <button
            onClick={handleRotate}
            disabled={loading}
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-800 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <RotateCw
              className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            {loading
              ? isVi
                ? 'Đang xoay...'
                : 'Rotating...'
              : isVi
                ? 'Xoay Khóa Mã Hóa'
                : 'Rotate Encryption Keys'}
          </button>
        </div>
      </div>

      {toast && (
        <div
          className={`rounded-lg border p-4 text-sm ${
            toast.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
              : 'border-red-500/30 bg-red-500/10 text-red-200'
          }`}
          role="alert"
        >
          <div className="flex items-center justify-between gap-2">
            <span>{toast.message}</span>
            <button
              onClick={dismissToast}
              className="shrink-0 text-xs underline hover:no-underline opacity-70 hover:opacity-100"
              aria-label={isVi ? 'Đóng' : 'Dismiss'}
            >
              {isVi ? 'Đóng' : 'Dismiss'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
