'use client';

import React from 'react';

export function ControlDeckDemoNotice({ lang }: { readonly lang: 'en' | 'vi' }) {
  const copy = lang === 'vi'
    ? 'BẢN XEM TRƯỚC THIẾT KẾ · MRR, thử nghiệm và kết xuất là số liệu minh họa. Chỉ mục gắn nhãn “Kiểm tra tài khoản” mới lấy từ bước kiểm tra tài khoản; dòng gắn nhãn “Giao dịch tài khoản” lấy từ dashboard đã đăng nhập. Cổng thanh toán, chia hoa hồng và bằng chứng Merkle chỉ hiển thị khi dữ liệu nguồn có ghi nhận.'
    : 'DESIGN PREVIEW · MRR, experiment, and render figures are illustrative. Only items tagged “Account check” come from the account readiness probe; rows tagged “Account transaction” come from the signed-in dashboard. Provider, affiliate split, and Merkle proof appear only when source data records them.';

  return (
    <aside
      role="note"
      className="mb-5 flex flex-wrap items-start gap-3 rounded-xl border border-amber-400/40 bg-[#121722]/95 px-4 py-3.5 text-xs leading-relaxed text-amber-200/95 shadow-[inset_0_1px_0_0_rgba(245,158,11,0.2)] sm:text-sm"
    >
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-400/50 bg-amber-400/15 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-amber-300">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden="true" />
        {lang === 'vi' ? 'CHẾ ĐỘ XEM TRƯỚC' : 'PREVIEW MODE'}
      </span>
      <p className="min-w-0 flex-1 font-medium text-amber-100/90">{copy}</p>
    </aside>
  );
}
