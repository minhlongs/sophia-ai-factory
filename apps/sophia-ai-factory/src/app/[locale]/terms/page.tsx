/**
 * Bilingual Terms of Service, Option A Pilot Agreement, BYOK Cost Disclosure & Refund Policy.
 * Reads canonical Option A SKU constants directly from OPTION_A_PILOT_CONTRACT.
 */

import { getLocale } from 'next-intl/server';
import { Link } from '@/navigation';
import {
  OPTION_A_PILOT_CONTRACT,
  OPTION_A_PILOT_COPY,
  formatOptionAPriceVnd,
} from '@/seed/config/tiers/option-a-pilot-contract';
import { isPilotInviteOnlyEnabled } from '@/seed/pilot/pilot-access-policy';

export const dynamic = 'force-dynamic';

function PilotPrivateBetaTerms({ isVi }: { readonly isVi: boolean }) {
  return (
    <main className="min-h-screen bg-background px-4 py-12 text-foreground">
      <article className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-3 border-b border-border pb-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-full bg-primary/15 px-3 py-1 font-mono text-xs font-semibold text-primary">
              2026-11-pilot-v2 · Private Beta
            </span>
            <Link
              href="/dashboard/first-value"
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
            >
              {isVi ? 'Quay lại Sophia' : 'Back to Sophia'}
            </Link>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isVi
              ? 'Điều Khoản Sử Dụng — Chương Trình Private Beta 7 Ngày ($0)'
              : 'Terms of Use — 7-Day Free Private Beta ($0)'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isVi
              ? 'Áp dụng cho khách mời duy nhất được cấp quyền truy cập môi trường thử nghiệm biệt lập Sophia AI Factory.'
              : 'Applies to invited participants on the isolated Sophia AI Factory Private Beta environment.'}
          </p>
        </header>

        <ul className="list-disc space-y-2 pl-6 text-sm text-muted-foreground">
          <li>
            {isVi
              ? 'Phạm vi: Thử nghiệm kín 7 ngày, phí nền tảng $0, tối đa 20 lượt tạo kịch bản AI thực tế (openai/gpt-4o-mini), chỉnh sửa phân cảnh, lưu nháp và xuất Markdown/JSON.'
              : 'Scope: 7-day invite-only beta, $0 platform fee, up to 20 live AI script generations (openai/gpt-4o-mini), scene editing, draft saving, and Markdown/JSON export.'}
          </li>
          <li>
            {isVi
              ? 'Mô hình khóa AI (Customer BYOK): Bạn tự nhập khóa API OpenRouter của riêng mình ngay trong ứng dụng; khóa được mã hóa AES-256-GCM và bạn có thể xóa bất cứ lúc nào. Cước gọi OpenRouter (nếu có) tính trực tiếp trên tài khoản OpenRouter của bạn.'
              : 'Customer BYOK AI Key: You supply your own OpenRouter API key in-app; it is stored encrypted with AES-256-GCM and removable anytime. OpenRouter token usage is billed only to your own OpenRouter account.'}
          </li>
          <li>
            {isVi
              ? 'Giới hạn an toàn: Không thu phí trên Sophia, không tự động đăng bài công khai, không bao gồm tạo video/TTS ngoài luồng kịch bản First Value.'
              : 'Safety boundaries: No Sophia billing, no public auto-publishing, and no video/TTS rendering outside the First-Value script workflow.'}
          </li>
          <li>
            {isVi
              ? 'Hỗ trợ & Xóa dữ liệu: Gửi trực tiếp tại mục "Hỗ trợ & Xóa dữ liệu" trong ứng dụng (/dashboard/first-value#support-deletion) để nhận mã biên nhận psr_... và được xử lý trong tối đa 72 giờ.'
              : 'Support & Data Deletion: Submit requests directly in the in-app "Support & Data Deletion" card (/dashboard/first-value#support-deletion) to receive a psr_... receipt ID with 72-hour fulfillment.'}
          </li>
        </ul>
      </article>
    </main>
  );
}

export default async function TermsPage() {
  const locale = (await getLocale()) === 'en' ? 'en' : 'vi';
  const isVi = locale === 'vi';

  if (isPilotInviteOnlyEnabled()) {
    return <PilotPrivateBetaTerms isVi={isVi} />;
  }
  const priceVnd = formatOptionAPriceVnd(locale);
  const {
    durationDays,
    includedMcu,
    guaranteedVideos,
    supportEmail,
    termsVersion,
    refundPolicy,
  } = OPTION_A_PILOT_CONTRACT;

  return (
    <main className="min-h-screen bg-background py-16 px-4">
      <article className="max-w-3xl mx-auto space-y-8 text-foreground">
        <header className="space-y-3 border-b border-border pb-6">
          <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            {isVi
              ? `Phiên bản ${termsVersion} · Mẫu tiêu chuẩn (đang chờ luật sư rà soát chính thức)`
              : `Version ${termsVersion} · Standard Draft (Pending Final Legal Counsel Review)`}
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            {isVi
              ? 'Điều Khoản Sử Dụng, Phụ Lục Gói Thử Nghiệm 14 Ngày (Option A) & Chính Sách Hoàn Tiền'
              : 'Terms of Service, 14-Day Paid Pilot Addendum (Option A) & Refund Policy'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isVi
              ? `Áp dụng cho nền tảng Sophia AI Factory (vận hành bởi MekongMind). Mọi yêu cầu hỗ trợ hoặc hoàn tiền gửi về ${supportEmail}.`
              : `Applies to the Sophia AI Factory platform (operated by MekongMind). Direct support and refund requests to ${supportEmail}.`}
          </p>
        </header>

        <section className="space-y-3" aria-labelledby="terms-pilot-scope">
          <h2 id="terms-pilot-scope" className="text-xl font-semibold">
            {isVi
              ? '1. Phạm Vi Gói Thử Nghiệm 14 Ngày — Option A (BASIC pilot_14d)'
              : '1. 14-Day Paid Pilot Scope — Option A (BASIC pilot_14d)'}
          </h2>
          <ul className="list-disc pl-6 space-y-2 text-sm text-muted-foreground">
            <li>
              {isVi
                ? `Giá niêm yết một lần: ${priceVnd}. Không tự động gia hạn sau khi hết hạn.`
                : `One-time fee: ${priceVnd}. Non-auto-renewing after expiration.`}
            </li>
            <li>
              {isVi
                ? `Quyền lợi bao gồm: ${durationDays} ngày sử dụng gói BASIC và ${includedMcu} MCU (Mekong Compute Units) cho lập kế hoạch chiến dịch, tạo kịch bản AI và tài sản tiếp thị liên kết (affiliate assets).`
                : `Included entitlements: ${durationDays} days of BASIC workspace access and ${includedMcu} MCU (Mekong Compute Units) for campaign planning, AI script drafting, and affiliate-asset workflows.`}
            </li>
            <li>
              {isVi
                ? `Giới hạn rõ ràng: Bao gồm ${guaranteedVideos} lượt dựng video cloud. Tính năng dựng video cloud chỉ áp dụng từ gói Growth (PREMIUM) trở lên.`
                : `Explicit exclusions: Includes ${guaranteedVideos} cloud video renders. Cloud video rendering requires Growth (PREMIUM) or higher.`}
            </li>
            <li>
              {isVi
                ? 'Không bao gồm tự động đăng công khai lên YouTube/TikTok và không bao gồm suy luận AI không giới hạn.'
                : 'Does not include public YouTube/TikTok auto-publishing or unlimited AI inference.'}
            </li>
          </ul>
        </section>

        <section className="space-y-3" aria-labelledby="terms-byok">
          <h2 id="terms-byok" className="text-xl font-semibold">
            {isVi
              ? '2. Mô Hình BYOK (Bring Your Own Key) & Chi Phí Nhà Cung Cấp AI Thứ Ba'
              : '2. BYOK (Bring Your Own Key) & Third-Party AI Provider Costs'}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isVi
              ? `Khách hàng kết nối khóa API riêng (ví dụ: OpenRouter, Anthropic, ElevenLabs, HeyGen, D-ID, fal.ai) qua Setup Wizard. Khóa API được mã hóa AES-256-GCM trong kho khóa workspace của bạn. Mọi chi phí gọi API bên thứ ba do các nhà cung cấp đó thu trực tiếp từ tài khoản của bạn; phí gói ${priceVnd} và ${includedMcu} MCU của Sophia không chi trả cho hóa đơn nhà cung cấp AI bên thứ ba.`
              : `Customers connect their own API keys (e.g., OpenRouter, Anthropic, ElevenLabs, HeyGen, D-ID, fal.ai) via the Setup Wizard. Keys are stored encrypted with AES-256-GCM in your workspace vault. All third-party AI provider usage is billed directly to your own provider accounts; Sophia's ${priceVnd} pilot fee and ${includedMcu} MCU do not pay for third-party provider bills.`}
          </p>
        </section>

        <section className="space-y-3" aria-labelledby="terms-payment">
          <h2 id="terms-payment" className="text-xl font-semibold">
            {isVi
              ? '3. Thanh Toán & Kích Hoạt Quyền Lợi'
              : '3. Payment Settlement & Entitlement Activation'}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isVi
              ? `Gói thử nghiệm này chỉ dùng chuyển khoản ngân hàng thủ công với mã tham chiếu riêng cho từng đơn. Quyền truy cập BASIC và ${includedMcu} MCU chỉ được cấp một lần, sau khi xác minh giao dịch với ngân hàng và phê duyệt kích hoạt.`
              : `This pilot uses manual bank transfer only, with a unique reference for each order. BASIC access and ${includedMcu} MCU are granted once, after bank settlement is independently verified and activation is approved.`}
          </p>
        </section>

        <section className="space-y-3" aria-labelledby="terms-refund">
          <h2 id="terms-refund" className="text-xl font-semibold">
            {isVi ? '4. Chính Sách Hoàn Tiền Thống Nhất' : '4. Unified Refund Policy'}
          </h2>
          <ul className="list-disc pl-6 space-y-2 text-sm text-muted-foreground">
            <li>
              {OPTION_A_PILOT_COPY[locale].scope}
              {OPTION_A_PILOT_COPY[locale].refund}
            </li>
            <li>
              {isVi
                ? `Gói đăng ký tiêu chuẩn (BASIC, PREMIUM, ENTERPRISE): Cửa sổ yêu cầu hoàn tiền ${refundPolicy.standardSubscriptionWindowDays} ngày (không hoàn lại thời gian và MCU đã sử dụng). Gói MASTER: cửa sổ ${refundPolicy.masterWindowDays} ngày.`
                : `Standard subscriptions (BASIC, PREMIUM, ENTERPRISE): ${refundPolicy.standardSubscriptionWindowDays}-day refund window (used time and consumed MCU are non-refundable). MASTER tier: ${refundPolicy.masterWindowDays}-day window.`}
            </li>
            <li>
              {isVi
                ? 'Chi phí API trả cho nhà cung cấp BYOK bên thứ ba không thuộc phạm vi hoàn tiền của Sophia AI Factory.'
                : 'Third-party BYOK AI provider charges are never refundable by Sophia AI Factory.'}
            </li>
            <li>
              {isVi
                ? `Quy trình hoàn tiền thủ công: Gửi mã đơn hàng về ${supportEmail}. Sau khi xác minh điều kiện, quản trị viên sẽ thực hiện chuyển khoản hoàn trả thủ công, cung cấp mã giao dịch ngân hàng đối soát và thu hồi quyền lợi/MCU còn lại của gói thử nghiệm.`
                : `Manual refund process: Email your order ID to ${supportEmail}. Once verified, an administrator executes the bank refund, records the bank payout reference, and revokes remaining pilot access and unused pilot MCU.`}
            </li>
          </ul>
        </section>

        <section className="space-y-3" aria-labelledby="terms-liability">
          <h2 id="terms-liability" className="text-xl font-semibold">
            {isVi
              ? '5. Giới Hạn Trách Nhiệm & Quyền Riêng Tư'
              : '5. Limitation of Liability & Privacy'}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isVi
              ? 'Sophia AI Factory cung cấp công cụ phần mềm hỗ trợ quy trình nội dung và chiến dịch; chúng tôi không cam kết doanh thu, lượt xem hay hoa hồng affiliate cụ thể. Tổng trách nhiệm bồi thường tối đa (nếu có) không vượt quá số tiền thực tế khách hàng đã thanh toán cho gói dịch vụ tương ứng.'
              : 'Sophia AI Factory provides workflow software for content and campaign operations; we do not guarantee specific revenue, views, or affiliate commissions. Aggregate liability is capped at the fees actually paid by the customer for the applicable plan.'}
          </p>
        </section>
      </article>
    </main>
  );
}
