import { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { GuideStepCard } from "@/forest/components/guide/guide-step-card";
import { GuideCallout } from "@/forest/components/guide/guide-callout";
import { buildBreadcrumbSchema } from "@/land/seo/schema-org";

export const revalidate = 60;

const SITE_URL = "https://sophia.agencyos.network";
const breadcrumbSchema = buildBreadcrumbSchema([
  { name: "Home", url: SITE_URL },
  { name: "Guide", url: `${SITE_URL}/guide` },
  { name: "Your First AI Video", url: `${SITE_URL}/guide/first-video` },
]);

export const metadata: Metadata = {
  title: "Your First AI Video in 5 Minutes — Sophia AI Factory",
  description:
    "Step-by-step guide to create your first AI video with Sophia. No technical skills required. / Hướng dẫn tạo video AI đầu tiên trong 5 phút.",
};

export default function FirstVideoPage() {
  return (
    <div className="max-w-3xl space-y-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      {/* Hero */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-3">
          Your First AI Video in 5 Minutes
          <span className="block text-xl mt-1 text-muted-foreground font-normal">
            Video AI Đầu Tiên Trong 5 Phút
          </span>
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          Follow these 5 steps — no technical skills needed. /{" "}
          Làm theo 5 bước đơn giản — không cần biết kỹ thuật.
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-foreground">5 Steps / 5 Bước</h2>

        <GuideStepCard
          step={1}
          title="Sign Up & Log In / Đăng Ký & Đăng Nhập"
          description={
            <span>
              Go to{" "}
              <span className="font-mono text-accent-400 text-xs bg-accent-500/10 px-1.5 py-0.5 rounded">
                sophia.agencyos.network
              </span>{" "}
              and create your account. Takes about{" "}
              <strong className="text-foreground">2 minutes</strong>. /{" "}
              Truy cập{" "}
              <span className="font-mono text-accent-400 text-xs bg-accent-500/10 px-1.5 py-0.5 rounded">
                sophia.agencyos.network
              </span>{" "}
              và tạo tài khoản. Chỉ mất khoảng 2 phút.
            </span>
          }
        />

        <GuideStepCard
          step={2}
          title="Enter API Keys / Nhập API Keys"
          description={
            <span>
              The <strong className="text-foreground">Setup Wizard</strong>{" "}
              guides you through entering your{" "}
              <strong className="text-foreground">OpenRouter</strong>,{" "}
              <strong className="text-foreground">ElevenLabs</strong>, and{" "}
              <strong className="text-foreground">D-ID</strong> API keys.
              Takes about <strong className="text-foreground">3 minutes</strong>.
              Keys are only entered once and stored encrypted. /{" "}
              Trình hướng dẫn thiết lập sẽ dẫn bạn qua từng bước nhập API keys.
              Chỉ cần nhập 1 lần duy nhất, được mã hóa an toàn.
            </span>
          }
        />

        <GuideCallout variant="info">
          Each service has a free tier to get started. /{" "}
          Mỗi dịch vụ đều có gói miễn phí để bắt đầu.
        </GuideCallout>

        <GuideStepCard
          step={3}
          title="Create a Campaign / Tạo Chiến Dịch"
          description={
            <span>
              Click{" "}
              <strong className="text-foreground">+ New Campaign</strong> in
              your Dashboard. Enter your topic, choose a voice, and hit{" "}
              <strong className="text-foreground">Create</strong>. Takes about{" "}
              <strong className="text-foreground">1 minute</strong>. /{" "}
              Nhấn <strong className="text-foreground">+ Tạo Chiến Dịch Mới</strong>{" "}
              trong Dashboard. Nhập chủ đề, chọn giọng nói, nhấn Tạo. Chỉ mất 1 phút.
            </span>
          }
        />

        <GuideStepCard
          step={4}
          title="Wait for Processing / Chờ Xử Lý"
          description={
            <span>
              Sophia automatically: writes the script → generates voice → creates
              the video. Takes{" "}
              <strong className="text-foreground">2–5 minutes</strong>. You
              will see a{" "}
              <strong className="text-accent-400">green status</strong> when
              done. /{" "}
              Sophia tự động: viết kịch bản → tạo giọng nói → tạo video. Chờ
              2–5 phút. Trạng thái xanh = xong.
            </span>
          }
        />

        <GuideStepCard
          step={5}
          title="Download & Share / Tải & Chia Sẻ"
          description={
            <span>
              Preview your video, download the MP4 file, and share it on
              YouTube or TikTok. You own 100% of the content. /{" "}
              Xem trước video, tải file MP4, chia sẻ lên YouTube hoặc TikTok.
              Bạn sở hữu 100% nội dung.
            </span>
          }
        />
      </div>

      <GuideCallout variant="tip" title="Pro Tip">
        The more specific your topic, the better the video. Instead of
        &quot;skincare product&quot;, try &quot;anti-aging serum for women
        over 40 in Vietnam&quot;. /{" "}
        Chủ đề càng cụ thể, video càng chất lượng. Thay vì &quot;sản phẩm
        dưỡng da&quot;, hãy thử &quot;serum chống lão hóa cho phụ nữ trên 40
        tuổi tại Việt Nam&quot;.
      </GuideCallout>

      {/* Next steps */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">
          Next Steps / Bước Tiếp Theo
        </h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            {
              href: "/guide/templates",
              label: "Campaign Templates",
              desc: "Save time with pre-built templates",
            },
            {
              href: "/guide/telegram",
              label: "Telegram Bot",
              desc: "Create videos from your phone",
            },
            {
              href: "/guide/payments/plans",
              label: "Pricing Plans",
              desc: "Upgrade for more videos",
            },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group bg-card/50 border border-border/40 rounded-xl p-4 hover:border-primary-500/40 hover:bg-primary-500/5 transition-colors"
            >
              <div className="text-sm font-medium text-foreground group-hover:text-primary-300 transition-colors flex items-center gap-1.5">
                {item.label}
                <ArrowRight
                  className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-hidden="true"
                />
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {item.desc}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
