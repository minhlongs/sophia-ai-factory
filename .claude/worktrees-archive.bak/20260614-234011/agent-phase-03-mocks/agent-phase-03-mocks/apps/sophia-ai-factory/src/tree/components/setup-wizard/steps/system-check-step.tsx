import React from 'react';
import { AlertCircle, Cloud, Check, Shield } from 'lucide-react';
import { ByokDoctrineBanner } from '@/tree/components/setup-wizard/byok-doctrine-banner';

export function SystemCheckStep() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <ByokDoctrineBanner />
      <h2 className="text-xl font-semibold text-foreground">Kiểm Tra Hệ Thống</h2>
      <div className="grid gap-4">
        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
          <div className="flex items-center gap-3">
            <Cloud className="text-foreground" />
            <div>
              <p className="font-medium text-foreground">Cloudflare Workers</p>
              <p className="text-sm text-muted-foreground">Hệ thống đang chạy trên edge (toàn cầu)</p>
            </div>
          </div>
          <Check className="text-foreground" />
        </div>
        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
          <div className="flex items-center gap-3">
            <Shield className="text-foreground" />
            <div>
              <p className="font-medium text-foreground">Bảo Mật</p>
              <p className="text-sm text-muted-foreground">API key được mã hóa AES-256 khi lưu</p>
            </div>
          </div>
          <Check className="text-foreground" />
        </div>
      </div>
      <div className="bg-accent/10 border border-accent/20 p-4 rounded-lg text-sm text-accent flex gap-2">
        <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
        <p>Bước tiếp theo: nhập API key cho dịch vụ AI. Bạn có thể bỏ qua và thêm sau trong Settings.</p>
      </div>
    </div>
  );
}
