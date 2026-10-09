import React from 'react';
import { ShieldCheck, Lock } from 'lucide-react';

interface PoliciesSecurityTabProps {
  isVi: boolean;
}

export function PoliciesSecurityTab({ isVi }: PoliciesSecurityTabProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Conflict Policy */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-sm space-y-4">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
          <h3 className="text-base font-semibold text-white">
            {isVi ? 'Quy Tắc Quyền Uy Hợp Đồng (Sophia Authority Bias)' : 'Sophia Contract Authority Bias'}
          </h3>
        </div>
        <p className="text-xs text-zinc-300 leading-relaxed">
          {isVi
            ? 'Khi hợp đồng doanh nghiệp đã ký số (deal_stage = closed_won), hệ thống Sophia AI Factory là nguồn sự thật tài chính duy nhất. Mọi cố gắng hạ bậc (downgrade) trạng thái từ CRM bên ngoài (Salesforce/HubSpot) đều bị từ chối tự động và đánh dấu trạng thái "ignored".'
            : 'When an enterprise deal has a cryptographically signed contract (closed_won), Sophia AI Factory is the ultimate financial authority. Any attempt by external CRMs to downgrade or revert the stage is automatically rejected and logged as "ignored".'}
        </p>
        <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-3 text-xs font-mono text-zinc-400 space-y-1">
          <div className="text-emerald-400">✓ closed_won + contract_sha256 = LOCKED</div>
          <div className="text-zinc-500">→ Incoming external downgrade = REJECTED (ignored)</div>
          <div className="text-zinc-500">→ Incoming SDR contact updates = APPLIED (non-destructive)</div>
        </div>
      </div>

      {/* Web Crypto Signature Policy */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-sm space-y-4">
        <div className="flex items-center gap-2.5">
          <Lock className="h-5 w-5 text-cyan-400" />
          <h3 className="text-base font-semibold text-white">
            {isVi ? 'Bảo Vệ Chữ Ký Mã Hóa & Chống Replay' : 'Web Crypto HMAC & Replay Protection'}
          </h3>
        </div>
        <p className="text-xs text-zinc-300 leading-relaxed">
          {isVi
            ? 'Mọi webhook phát đi đều mang tiêu đề X-Sophia-Signature-256 được tính toán qua crypto.subtle HMAC-SHA256 theo định dạng t=<timestamp>,v1=<hex>. Cửa sổ kiểm tra chống tấn công phát lại (Replay Attack) được áp dụng nghiêm ngặt ở mức 300 giây (5 phút).'
            : 'Every outbound webhook carries the X-Sophia-Signature-256 header computed via crypto.subtle HMAC-SHA256 in format t=<timestamp>,v1=<hex>. Anti-replay attack tolerance is enforced at 300 seconds (5 minutes).'}
        </p>
        <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-3 text-xs font-mono text-zinc-400 space-y-1">
          <div className="text-cyan-400">X-Sophia-Signature-256: t=...,v1=&lt;hex&gt;</div>
          <div className="text-zinc-500">Tolerance: |t_now - t_sig| &le; 300s</div>
          <div className="text-zinc-500">Backoff: 0s, 30s, 120s, 600s, 3600s with &plusmn;10% jitter</div>
        </div>
      </div>
    </div>
  );
}
