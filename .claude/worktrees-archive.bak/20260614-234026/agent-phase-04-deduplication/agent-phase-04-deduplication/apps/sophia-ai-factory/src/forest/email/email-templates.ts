/**
 * Email HTML templates for transactional emails.
 *
 * Templates: welcome, magic-link, mission-complete, trial-ending, invoice
 * All return plain HTML strings — no React Email dependency.
 */

const BRAND_COLOR = '#6750A4';

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://sophia.agencyos.network';
}

function footer(): string {
  const base = getBaseUrl();
  return `
  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e0e0e0;font-size:12px;color:#666;">
    <p>Sophia AI Factory — Robot-as-a-Service Platform</p>
    <p><a href="${base}" style="color:${BRAND_COLOR}">Sophia AI Factory</a> · <a href="${base}/dashboard" style="color:${BRAND_COLOR}">Dashboard</a></p>
  </div>
`;
}

function wrap(body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#1a1a1a;max-width:600px;margin:0 auto;padding:24px;">
${body}${footer()}</body></html>`;
}

// ── Magic Link ──────────────────────────────────────────────────────────────

export function magicLinkEmail(token: string, baseUrl?: string): string {
  const base = baseUrl ?? getBaseUrl();
  const link = `${base}/api/auth/callback?token=${token}`;
  return wrap(`
    <h2 style="color:${BRAND_COLOR}">Đăng nhập Sophia AI</h2>
    <p>Nhấn nút bên dưới để đăng nhập. Link có hiệu lực trong 15 phút.</p>
    <a href="${link}" style="display:inline-block;background:${BRAND_COLOR};color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0;">Đăng Nhập</a>
    <p style="font-size:13px;color:#666;">Nếu bạn không yêu cầu email này, vui lòng bỏ qua.</p>
  `);
}

// ── Welcome ─────────────────────────────────────────────────────────────────

export function welcomeEmail(name: string, tierName: string, mcuCredits: number): string {
  const base = getBaseUrl();
  return wrap(`
    <h2 style="color:${BRAND_COLOR}">Chào mừng đến Sophia AI Factory!</h2>
    <p>Xin chào ${name},</p>
    <p>Gói <strong>${tierName}</strong> của bạn đã kích hoạt với <strong>${mcuCredits.toLocaleString()} MCU</strong> credits.</p>
    <h3>Bắt đầu nhanh</h3>
    <ol>
      <li>Tạo AI mission đầu tiên tại <a href="${base}/dashboard/missions/new" style="color:${BRAND_COLOR}">Dashboard</a></li>
      <li>Tạo API key tại <a href="${base}/dashboard/settings/api-keys" style="color:${BRAND_COLOR}">Settings → API Keys</a></li>
      <li>Xem <a href="${base}/docs/api" style="color:${BRAND_COLOR}">API Reference</a></li>
    </ol>
    <p>Câu hỏi? Reply email này — chúng tôi phản hồi trong 2 giờ.</p>
    <p>— Sophia AI Team</p>
  `);
}

// ── Mission Complete ────────────────────────────────────────────────────────

export function missionCompleteEmail(
  name: string,
  missionId: string,
  command: string,
  summary: string,
): string {
  const base = getBaseUrl();
  return wrap(`
    <h2 style="color:${BRAND_COLOR}">Mission hoàn thành</h2>
    <p>Xin chào ${name},</p>
    <p>Mission <code>${command}</code> đã xong:</p>
    <div style="background:#f5f5f5;padding:16px;border-radius:8px;margin:16px 0;">
      <p style="margin:0;font-size:14px;"><strong>ID:</strong> ${missionId}</p>
      <p style="margin:8px 0 0;font-size:14px;"><strong>Kết quả:</strong> ${summary}</p>
    </div>
    <a href="${base}/dashboard/missions/${missionId}" style="display:inline-block;background:${BRAND_COLOR};color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Xem kết quả</a>
  `);
}

// ── Trial Ending ────────────────────────────────────────────────────────────

export function trialEndingEmail(name: string, daysLeft: number): string {
  const base = getBaseUrl();
  return wrap(`
    <h2 style="color:${BRAND_COLOR}">Dùng thử còn ${daysLeft} ngày</h2>
    <p>Xin chào ${name},</p>
    <p>MCU credits miễn phí sắp hết. Nâng cấp để tiếp tục sử dụng AI missions.</p>
    <a href="${base}/dashboard/billing/upgrade" style="display:inline-block;background:${BRAND_COLOR};color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Nâng cấp</a>
    <p style="margin-top:16px;font-size:13px;color:#666;">Gói từ $199/tháng với 500 MCU credits.</p>
  `);
}

// ── Invoice / Payment Confirmation ──────────────────────────────────────────

export function invoiceEmail(
  name: string,
  amount: string,
  tierName: string,
  invoiceDate: string,
): string {
  const base = getBaseUrl();
  return wrap(`
    <h2 style="color:${BRAND_COLOR}">Thanh toán thành công</h2>
    <p>Xin chào ${name},</p>
    <p>Chúng tôi đã nhận thanh toán. Biên lai:</p>
    <div style="background:#f5f5f5;padding:16px;border-radius:8px;margin:16px 0;">
      <p style="margin:0;font-size:14px;"><strong>Gói:</strong> ${tierName}</p>
      <p style="margin:8px 0 0;font-size:14px;"><strong>Số tiền:</strong> ${amount}</p>
      <p style="margin:8px 0 0;font-size:14px;"><strong>Ngày:</strong> ${invoiceDate}</p>
    </div>
    <a href="${base}/dashboard/billing" style="display:inline-block;background:${BRAND_COLOR};color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Xem billing</a>
  `);
}
