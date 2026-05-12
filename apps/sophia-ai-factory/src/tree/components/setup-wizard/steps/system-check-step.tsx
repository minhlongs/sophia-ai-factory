import React from 'react';
import { AlertCircle, Cloud, Check, Shield } from 'lucide-react';

export function SystemCheckStep() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <h2 className="text-xl font-semibold text-foreground">Kiểm Tra Hệ Thống</h2>
      <div className="grid gap-4">
        <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-100 dark:border-green-900">
          <div className="flex items-center gap-3">
            <Cloud className="text-green-600 dark:text-green-400" />
            <div>
              <p className="font-medium text-foreground">Cloudflare Workers</p>
              <p className="text-sm text-green-700 dark:text-green-400">Hệ thống đang chạy trên edge (toàn cầu)</p>
            </div>
          </div>
          <Check className="text-green-600 dark:text-green-400" />
        </div>
        <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-100 dark:border-green-900">
          <div className="flex items-center gap-3">
            <Shield className="text-green-600 dark:text-green-400" />
            <div>
              <p className="font-medium text-foreground">Bảo Mật</p>
              <p className="text-sm text-green-700 dark:text-green-400">API key được mã hóa AES-256 khi lưu</p>
            </div>
          </div>
          <Check className="text-green-600 dark:text-green-400" />
        </div>
      </div>
      <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg text-sm text-blue-800 dark:text-blue-300 flex gap-2">
        <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
        <p>Bước tiếp theo: nhập API key cho dịch vụ AI. Bạn có thể bỏ qua và thêm sau trong Settings.</p>
      </div>
    </div>
  );
}
