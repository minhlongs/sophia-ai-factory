export const dynamic = 'force-dynamic';

/**
 * Bilingual Privacy Policy & Data Processing Disclosure (/[locale]/privacy).
 *
 * Discloses actual data controller responsibilities, third-party processors
 * (Cloudflare Access/Workers/D1 and OpenRouter BYOK inference), AES-256-GCM
 * key encryption, retention window, and operational in-app Support & Data
 * Deletion request handling (72-hour SLA) without any unverified email address.
 *
 * @module app/[locale]/privacy/page
 */

import { getLocale } from 'next-intl/server';
import { Link } from '@/navigation';

export default async function PrivacyPage() {
  const locale = (await getLocale()) === 'en' ? 'en' : 'vi';
  const isVi = locale === 'vi';

  return (
    <main className="min-h-screen bg-background px-4 py-12 text-foreground">
      <article className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-3 border-b border-border pb-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-full bg-primary/15 px-3 py-1 font-mono text-xs font-semibold text-primary">
              2026-11-pilot-v2
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
              ? 'Chính Sách Bảo Mật & Xử Lý Dữ Liệu — Sophia AI Factory'
              : 'Privacy Policy & Data Processing Notice — Sophia AI Factory'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isVi
              ? 'Áp dụng cho Sophia AI Factory (vận hành bởi MekongMind), bao gồm môi trường Private Beta biệt lập.'
              : 'Applies to Sophia AI Factory (operated by MekongMind), including the isolated Private Beta environment.'}
          </p>
        </header>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">
            {isVi ? '1. Đơn Vị Kiểm Soát Dữ Liệu & Phạm Vi Thu Thập' : '1. Data Controller & Data Collected'}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {isVi
              ? 'MekongMind (đội ngũ vận hành Sophia AI Factory) xử lý dữ liệu tối thiểu cần thiết để cung cấp dịch vụ: địa chỉ email đăng ký được cấp quyền, phiên xác thực Better Auth, khóa API OpenRouter do bạn tự cung cấp (BYOK — lưu mã hóa AES-256-GCM), nội dung mô tả kinh doanh (brief), kịch bản nháp do AI tạo, đánh giá phản hồi và yêu cầu hỗ trợ/xóa dữ liệu trong ứng dụng.'
              : 'MekongMind (operating Sophia AI Factory) processes only the minimum data needed to deliver the service: your invited account email, Better Auth session state, your self-supplied OpenRouter API key (BYOK — stored encrypted with AES-256-GCM), business briefs, private AI script drafts, product feedback, and in-app support or deletion requests.'}
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">
            {isVi ? '2. Hạ Tầng & Nhà Cung Cấp Xử Lý Phụ (Sub-processors)' : '2. Infrastructure & Sub-processors'}
          </h2>
          <ul className="list-disc space-y-2 pl-6 text-sm text-muted-foreground">
            <li>
              <strong>Cloudflare (Access, Workers, D1):</strong>{' '}
              {isVi
                ? 'Xác thực vành đai theo đúng địa chỉ email được mời, thực thi ứng dụng ở tầng biên và lưu trữ dữ liệu Private Beta trong cơ sở dữ liệu biệt lập sophia-pilot-db (tách biệt hoàn toàn khỏi cơ sở dữ liệu sản phẩm chính).'
                : 'Enforces single-email perimeter authentication, edge compute execution, and isolated storage in sophia-pilot-db (strictly separated from production databases).'}
            </li>
            <li>
              <strong>OpenRouter (Model: openai/gpt-4o-mini — Customer BYOK):</strong>{' '}
              {isVi
                ? 'Khi bạn bấm kiểm tra khóa hoặc tạo kịch bản, hệ thống giải mã khóa OpenRouter BYOK của bạn trong bộ nhớ tạm để gửi yêu cầu tạo kịch bản tới OpenRouter (hạ tầng AI tại Mỹ/toàn cầu). Hệ thống không ghi plaintext khóa API, nội dung brief hay kịch bản vào nhật ký telemetry ứng dụng.'
                : 'When you verify your key or generate a script, your OpenRouter BYOK key is decrypted in memory solely to send the prompt to OpenRouter (US/global AI inference). Plaintext API keys, briefs, and generated scripts are never written to application telemetry logs.'}
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">
            {isVi ? '3. Cam Kết An Toàn Trong Đợt Private Beta' : '3. Private Beta Safeguards'}
          </h2>
          <ul className="list-disc space-y-1.5 pl-6 text-sm text-muted-foreground">
            <li>
              {isVi
                ? 'Kịch bản tạo ra là bản nháp riêng tư của bạn — không bao giờ tự động đăng công khai.'
                : 'Generated scripts are private drafts — never auto-published to social channels.'}
            </li>
            <li>
              {isVi
                ? 'Không thu phí nền tảng ($0) và không bật cổng thanh toán trong đợt thử nghiệm.'
                : 'Zero platform fee ($0) and all payment gateways remain disabled during the beta.'}
            </li>
            <li>
              {isVi
                ? 'Vui lòng không nhập mật khẩu cá nhân, dữ liệu thẻ thanh toán hoặc thông tin cá nhân nhạy cảm vào ô brief.'
                : 'Please do not enter passwords, payment card details, or sensitive personal data into brief fields.'}
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">
            {isVi
              ? '4. Thời Hạn Lưu Trữ, Hỗ Trợ & Quyền Yêu Cầu Xóa Dữ Liệu (72 Giờ)'
              : '4. Retention, Support & Right to Data Deletion (72-Hour SLA)'}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {isVi
              ? 'Dữ liệu thử nghiệm được lưu trong suốt đợt Private Beta 7 ngày và tối đa 7 ngày sau khi kết thúc để bạn kịp xuất kịch bản. Bạn có thể xóa khóa OpenRouter BYOK ngay lập tức trong ứng dụng bất kỳ lúc nào, và gửi yêu cầu Hỗ trợ hoặc Xóa toàn bộ dữ liệu trực tiếp tại mục "Hỗ trợ & Xóa dữ liệu" ngay trong màn hình làm việc Sophia (/dashboard/first-value#support-deletion). Mỗi yêu cầu trả về ngay mã biên nhận định danh (psr_...) vào hàng đợi trực tiếp của Nhà sáng lập và được xử lý hoàn tất trong vòng tối đa 72 giờ.'
              : 'Pilot workspace data is retained for the 7-day Private Beta window and up to 7 days afterward so you can export your work. You may remove your OpenRouter BYOK key immediately in-app at any time, and submit a Support or Full Data Deletion request directly in the "Support & Data Deletion" panel inside your Sophia workspace (/dashboard/first-value#support-deletion). Every submission immediately returns a verifiable receipt ID (psr_...) into the Founder operator queue and is fulfilled within 72 hours.'}
          </p>
        </section>
      </article>
    </main>
  );
}
