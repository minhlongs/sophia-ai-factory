/**
 * Bilingual EN/VI email template for account deletion confirmation.
 * Wave 21 Phase 02.
 */

export function buildDeleteConfirmHtml(rawUrl: string, cooldownDays: number): string {
  const url =
    rawUrl.startsWith('https://') || rawUrl.startsWith('http://localhost')
      ? rawUrl.replace(/"/g, '&quot;').replace(/</g, '&lt;')
      : '#';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,sans-serif;line-height:1.6;max-width:600px;margin:0 auto;padding:24px;">
  <h2 style="color:#dc2626">Confirm account deletion</h2>
  <p>You requested to permanently delete your Sophia AI Factory account.</p>
  <p>Click below to confirm. After confirmation, your account enters a
     <strong>${cooldownDays}-day cooldown</strong> period during which you can cancel.
     After ${cooldownDays} days, all data will be permanently erased.</p>
  <a href="${url}" style="display:inline-block;background:#dc2626;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0;">
    Confirm deletion · Xác nhận xoá
  </a>
  <p style="font-size:13px;color:#666;">If you did not request this, ignore this email — your account is unchanged.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
  <h3 style="color:#dc2626;margin-bottom:8px;">Xác nhận xoá tài khoản</h3>
  <p>Bạn vừa yêu cầu xoá vĩnh viễn tài khoản Sophia AI Factory.</p>
  <p>Nhấn nút phía trên để xác nhận. Sau khi xác nhận, tài khoản sẽ vào giai đoạn
     <strong>chờ ${cooldownDays} ngày</strong> — bạn có thể huỷ trong thời gian này.
     Sau ${cooldownDays} ngày, toàn bộ dữ liệu sẽ bị xoá vĩnh viễn.</p>
  <p style="font-size:13px;color:#666;">Nếu bạn không yêu cầu, vui lòng bỏ qua — tài khoản không thay đổi.</p>
</body></html>`;
}
