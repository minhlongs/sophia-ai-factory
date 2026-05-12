/**
 * /dashboard/help/troubleshooting — Bilingual self-fix guide for common issues.
 * Top 10 issues a non-tech partner hits, each with paste-ready fix steps.
 *
 * @module app/[locale]/dashboard/help/troubleshooting/page
 */

import { AlertTriangle, CheckCircle } from 'lucide-react'

interface Props {
  params: Promise<{ locale: string }>
}

export const metadata = {
  title: 'Troubleshooting | Sophia AI',
  description: 'Self-fix guide for common Sophia AI issues',
}

type Severity = 'high' | 'medium' | 'low'

interface Issue {
  severity: Severity
  symptom: string
  cause: string
  steps: string[]
  followUp?: { href: string; label: string }
}

const ISSUES_VI: Issue[] = [
  {
    severity: 'high',
    symptom: 'Magic link rơi vào spam / Promotions',
    cause: 'Mỗi inbox lọc khác nhau. Lần đầu nhận từ Sophia, Gmail/Outlook chưa "tin tưởng" tên miền.',
    steps: [
      'Kiểm tra tab Spam / Junk / Quảng cáo',
      'Click "Move to Inbox" và "Not Spam"',
      'Thêm support@sophia.agencyos.network vào danh bạ',
      'Nếu vẫn không thấy sau 2 phút: vào /welcome/invalid để gửi lại',
    ],
    followUp: { href: '/welcome/invalid', label: 'Gửi lại magic link' },
  },
  {
    severity: 'high',
    symptom: 'HeyGen "Verify" thất bại trên trang BYOK',
    cause: 'API key sai định dạng, đã thu hồi, hoặc tài khoản hết credit.',
    steps: [
      'Mở app.heygen.com → Avatar → Settings → API Keys',
      'Copy lại key (không có khoảng trắng đầu/cuối)',
      'Quay lại /dashboard/byok → xóa key cũ → paste key mới → Verify',
      'Nếu vẫn fail: kiểm tra credit HeyGen còn không',
    ],
    followUp: { href: '/dashboard/byok', label: 'Mở BYOK' },
  },
  {
    severity: 'high',
    symptom: 'Telegram bot @Sophia_Bbot không phản hồi',
    cause: 'Pairing token chưa được consume, hoặc bạn chưa bấm Start.',
    steps: [
      'Mở Telegram → tìm @Sophia_Bbot',
      'Bấm Start (hoặc gõ /start)',
      'Nếu vẫn không phản hồi: vào /welcome/[token] → Connect Telegram lại',
      'Token dùng 1 lần — request mới nếu cần',
    ],
    followUp: { href: '/guide/telegram', label: 'Hướng dẫn Telegram' },
  },
  {
    severity: 'medium',
    symptom: 'Mã FREE100 bị từ chối ở /pricing',
    cause: 'Gõ sai (FREE100 phân biệt hoa thường), có khoảng trắng, hoặc đã hết 50 chỗ.',
    steps: [
      'Đảm bảo gõ chính xác: F-R-E-E-1-0-0 (toàn bộ chữ in hoa)',
      'Xóa khoảng trắng đầu/cuối',
      'Nếu vẫn fail: kiểm tra với người đã gửi mã cho bạn (có thể hết slot)',
    ],
  },
  {
    severity: 'medium',
    symptom: 'Video đầu tiên kẹt ở trạng thái "Generating"',
    cause: 'Render thật cần 2-5 phút. Đôi khi HeyGen queue dài.',
    steps: [
      'Đợi ít nhất 5 phút',
      'Refresh /dashboard/videos',
      'Nếu sau 15 phút vẫn "Generating": kiểm tra /dashboard/system-health',
      'Nếu HeyGen down: thử lại sau, không mất credit',
    ],
    followUp: { href: '/dashboard/system-health', label: 'Kiểm tra trạng thái hệ thống' },
  },
  {
    severity: 'medium',
    symptom: 'Thanh toán xong nhưng tier không kích hoạt',
    cause: 'NOWPayments IPN webhook đôi khi delay 1-3 phút.',
    steps: [
      'Đợi 5 phút',
      'Refresh /dashboard/billing — kiểm tra Order Status',
      'Nếu sau 10 phút vẫn không active: kiểm tra email xác nhận từ NOWPayments',
      'Forward email xác nhận cho support@sophia.agencyos.network',
    ],
  },
  {
    severity: 'medium',
    symptom: 'BYOK key bị từ chối với lỗi "Invalid format"',
    cause: 'Validator client-side phát hiện sai định dạng (prefix, độ dài).',
    steps: [
      'OpenRouter: phải bắt đầu bằng "sk-or-v1-"',
      'ElevenLabs: 32 ký tự hex',
      'D-ID: chuỗi base64 không có dấu cách',
      'Nếu copy đúng mà vẫn fail: thử "Show key" trên dashboard nhà cung cấp để verify',
    ],
  },
  {
    severity: 'low',
    symptom: 'Không thấy SOPs trong /dashboard/sops',
    cause: 'Chưa install SOP nào từ marketplace.',
    steps: [
      'Vào /dashboard/sop-marketplace',
      'Chọn 1 SOP template (ví dụ: "Product Launch 7-Video")',
      'Bấm Install — SOP xuất hiện ở /dashboard/sops',
      'Bấm Run để chạy lần đầu',
    ],
    followUp: { href: '/dashboard/sop-marketplace', label: 'Mở marketplace' },
  },
  {
    severity: 'low',
    symptom: 'Bấm back trong browser → magic link "đã dùng"',
    cause: 'Magic link là single-use. Sau khi đăng nhập, link cũ không còn hiệu lực.',
    steps: [
      'Đây là hành vi bảo mật bình thường',
      'Vào /dashboard trực tiếp (đã đăng nhập)',
      'Nếu bị log out: vào /login để đăng nhập lại bằng email',
    ],
  },
  {
    severity: 'low',
    symptom: 'UI hiện sai ngôn ngữ',
    cause: 'URL prefix sai hoặc cookie locale lỗi.',
    steps: [
      'Đổi URL prefix: /vi/dashboard cho Tiếng Việt, /en/dashboard cho English',
      'Hoặc Settings → Language → chọn lại',
      'Nếu vẫn sai: xóa cookie và đăng nhập lại',
    ],
  },
]

const ISSUES_EN: Issue[] = [
  {
    severity: 'high',
    symptom: 'Magic link lands in Spam / Promotions',
    cause: 'Each inbox filters differently. First message from Sophia is not yet trusted.',
    steps: [
      'Check Spam / Junk / Promotions folder',
      'Click "Move to Inbox" and "Not Spam"',
      'Add support@sophia.agencyos.network to contacts',
      'If still missing after 2 min: go to /welcome/invalid to resend',
    ],
    followUp: { href: '/welcome/invalid', label: 'Resend magic link' },
  },
  {
    severity: 'high',
    symptom: 'HeyGen "Verify" fails on BYOK page',
    cause: 'API key wrong format, revoked, or provider account out of credit.',
    steps: [
      'Open app.heygen.com → Avatar → Settings → API Keys',
      'Re-copy the key (no leading/trailing whitespace)',
      'Back to /dashboard/byok → delete old key → paste new → Verify',
      'If still fails: check remaining HeyGen credit',
    ],
    followUp: { href: '/dashboard/byok', label: 'Open BYOK' },
  },
  {
    severity: 'high',
    symptom: 'Telegram bot @Sophia_Bbot does not respond',
    cause: 'Pairing token not consumed, or you did not tap Start.',
    steps: [
      'Open Telegram → find @Sophia_Bbot',
      'Tap Start (or type /start)',
      'If still silent: go to /welcome/[token] → Connect Telegram again',
      'Tokens are single-use — request a fresh one if needed',
    ],
    followUp: { href: '/guide/telegram', label: 'Telegram guide' },
  },
  {
    severity: 'medium',
    symptom: 'FREE100 code rejected on /pricing',
    cause: 'Wrong case (FREE100 is case-sensitive), whitespace, or all 50 slots used.',
    steps: [
      'Confirm exact spelling: F-R-E-E-1-0-0 (all uppercase)',
      'Remove leading/trailing whitespace',
      'If still fails: check with the person who sent you the code (may be out of slots)',
    ],
  },
  {
    severity: 'medium',
    symptom: 'First video stuck on "Generating"',
    cause: 'Real rendering takes 2-5 minutes. HeyGen queue may be long.',
    steps: [
      'Wait at least 5 minutes',
      'Refresh /dashboard/videos',
      'After 15 minutes still "Generating": check /dashboard/system-health',
      'If HeyGen is down: retry later — no credit will be charged',
    ],
    followUp: { href: '/dashboard/system-health', label: 'Check system status' },
  },
  {
    severity: 'medium',
    symptom: 'Payment confirmed but tier not active',
    cause: 'NOWPayments IPN webhook can delay 1-3 minutes.',
    steps: [
      'Wait 5 minutes',
      'Refresh /dashboard/billing — check Order Status',
      'After 10 minutes still inactive: check NOWPayments confirmation email',
      'Forward the confirmation email to support@sophia.agencyos.network',
    ],
  },
  {
    severity: 'medium',
    symptom: 'BYOK key rejected with "Invalid format"',
    cause: 'Client-side validator detected wrong prefix or length.',
    steps: [
      'OpenRouter: must start with "sk-or-v1-"',
      'ElevenLabs: 32 hex characters',
      'D-ID: base64 string with no spaces',
      'If copy is correct but still fails: use "Show key" on the provider dashboard to verify',
    ],
  },
  {
    severity: 'low',
    symptom: 'No SOPs visible in /dashboard/sops',
    cause: 'No SOP installed from marketplace yet.',
    steps: [
      'Open /dashboard/sop-marketplace',
      'Pick a SOP template (e.g. "Product Launch 7-Video")',
      'Click Install — SOP appears in /dashboard/sops',
      'Click Run for the first execution',
    ],
    followUp: { href: '/dashboard/sop-marketplace', label: 'Open marketplace' },
  },
  {
    severity: 'low',
    symptom: 'Browser back button shows "magic link used"',
    cause: 'Magic links are single-use. After sign-in, old link is invalid.',
    steps: [
      'This is normal security behavior',
      'Go to /dashboard directly (you are already signed in)',
      'If signed out: go to /login and sign in with email',
    ],
  },
  {
    severity: 'low',
    symptom: 'UI shows wrong language',
    cause: 'Wrong URL prefix or stale locale cookie.',
    steps: [
      'Change URL prefix: /vi/dashboard for Vietnamese, /en/dashboard for English',
      'Or Settings → Language → re-select',
      'If still wrong: clear cookies and sign in again',
    ],
  },
]

const SEVERITY_STYLES: Record<Severity, { bg: string; border: string; label: { vi: string; en: string } }> = {
  high: {
    bg: 'bg-red-950/20',
    border: 'border-red-900/40',
    label: { vi: 'Cao', en: 'High' },
  },
  medium: {
    bg: 'bg-amber-950/20',
    border: 'border-amber-900/40',
    label: { vi: 'Trung bình', en: 'Medium' },
  },
  low: {
    bg: 'bg-zinc-900/40',
    border: 'border-zinc-800',
    label: { vi: 'Thấp', en: 'Low' },
  },
}

export default async function TroubleshootingPage({ params }: Props) {
  const { locale } = await params
  const isVi = locale.startsWith('vi')
  const issues = isVi ? ISSUES_VI : ISSUES_EN

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">
          {isVi ? 'Khắc phục sự cố' : 'Troubleshooting'}
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          {isVi
            ? 'Top 10 sự cố phổ biến + cách tự xử lý không cần liên hệ support.'
            : 'Top 10 common issues + self-fix steps — no need to contact support.'}
        </p>
      </div>

      <div className="space-y-4">
        {issues.map((issue, i) => {
          const style = SEVERITY_STYLES[issue.severity]
          return (
            <div
              key={i}
              className={`rounded-xl border ${style.border} ${style.bg} p-5 space-y-3`}
            >
              <div className="flex items-start gap-3">
                <AlertTriangle
                  className="w-5 h-5 text-amber-400 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold text-zinc-100">{issue.symptom}</h2>
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300">
                      {isVi ? style.label.vi : style.label.en}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    <span className="text-zinc-500">{isVi ? 'Nguyên nhân: ' : 'Cause: '}</span>
                    {issue.cause}
                  </p>
                </div>
              </div>

              <ol className="pl-11 space-y-1.5">
                {issue.steps.map((step, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-zinc-300">
                    <CheckCircle
                      className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>{step}</span>
                  </li>
                ))}
              </ol>

              {issue.followUp && (
                <div className="pl-11">
                  <a
                    href={issue.followUp.href}
                    className="inline-block mt-1 text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-violet-300 rounded-lg transition-colors"
                  >
                    {issue.followUp.label} →
                  </a>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 text-center">
        <p className="text-sm text-zinc-400">
          {isVi
            ? 'Sự cố của bạn không có trong danh sách? Email '
            : 'Issue not listed? Email '}
          <a
            href="mailto:support@sophia.agencyos.network"
            className="text-violet-400 hover:underline"
          >
            support@sophia.agencyos.network
          </a>
          {isVi ? ' — phản hồi trong 1h.' : ' — replies within 1h.'}
        </p>
      </div>
    </div>
  )
}
