'use client';

import React from 'react';

export function ControlDeckDemoNotice({ lang }: { readonly lang: 'en' | 'vi' }) {
  const copy = lang === 'vi'
    ? 'BẢN XEM TRƯỚC THIẾT KẾ · MRR, thử nghiệm và kết xuất là số liệu minh họa. Chỉ mục gắn nhãn “Kiểm tra tài khoản” mới lấy từ bước kiểm tra tài khoản; dòng gắn nhãn “Giao dịch tài khoản” lấy từ dashboard đã đăng nhập. Cổng thanh toán, chia hoa hồng và bằng chứng Merkle chỉ hiển thị khi dữ liệu nguồn có ghi nhận.'
    : 'DESIGN PREVIEW · MRR, experiment, and render figures are illustrative. Only items tagged “Account check” come from the account readiness probe; rows tagged “Account transaction” come from the signed-in dashboard. Provider, affiliate split, and Merkle proof appear only when source data records them.';

  return (
    <aside role="note" className="mb-5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-200">
      {copy}
    </aside>
  );
}
