"use client";

import { ScrollReveal } from "@/components/ui/scroll-reveal";

/** Feature card data — Vietnamese, dark-themed, Video Factory + RaaS focus */
const features = [
  {
    icon: "smart_toy",
    title: "AI Mission Engine",
    description: "Deploy autonomous AI agents thực thi tasks phức tạp — từ tạo video đến viết nội dung, tất cả tự động hóa.",
    highlight: "Plan → Execute → Deliver",
    span: "md:col-span-2",
    gradient: "from-blue-500/20 to-cyan-500/10",
  },
  {
    icon: "videocam",
    title: "Video Factory",
    description: "Tạo video AI chất lượng cao với D-ID, ElevenLabs voice cloning, auto-subtitle và đăng tải đa kênh.",
    highlight: "Video AI tự động",
    span: "",
    gradient: "from-purple-500/20 to-violet-500/10",
  },
  {
    icon: "toll",
    title: "MCU Credits",
    description: "Chỉ trả cho những gì bạn dùng. Billing minh bạch, không phí ẩn, không bất ngờ.",
    highlight: "Usage-based pricing",
    span: "",
    gradient: "from-amber-500/20 to-orange-500/10",
  },
  {
    icon: "api",
    title: "Developer-First API",
    description: "RESTful API với real-time SSE streaming, webhook callbacks và TypeScript SDK. Tích hợp trong 5 phút.",
    highlight: "Integrate in 5 minutes",
    span: "md:col-span-2",
    gradient: "from-green-500/20 to-emerald-500/10",
  },
];

export function Features() {
  return (
    <section id="features" className="py-28 relative overflow-hidden">
      {/* Background glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-[150px] -z-10"
        style={{ background: "var(--neon-purple)", opacity: 0.06 }}
      />

      <div className="container mx-auto px-4">
        <ScrollReveal className="text-center mb-20">
          <span
            className="inline-flex items-center gap-2 px-4 py-1.5 mb-5 text-xs font-semibold uppercase tracking-wider rounded-full border"
            style={{
              color: "var(--neon-cyan)",
              background: "rgba(0,240,255,0.05)",
              borderColor: "rgba(0,240,255,0.1)",
            }}
          >
            <span className="material-symbols-outlined text-sm">category</span>
            Nền Tảng
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-5 tracking-tight">
            Xây Cho Agency,{" "}
            <span className="text-gradient">Vận Hành Bằng AI</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Tất cả những gì bạn cần để tự động hóa AI workflows theo quy mô
          </p>
        </ScrollReveal>

        {/* Bento Grid */}
        <div className="grid md:grid-cols-4 gap-4 max-w-5xl mx-auto">
          {features.map((feature, i) => (
            <ScrollReveal key={feature.title} delay={i * 100} className={feature.span}>
              <div className="group gradient-border h-full cursor-pointer">
                <div className="relative h-full p-7 rounded-[16px] bg-card">
                  {/* Hover gradient glow */}
                  <div
                    className={`absolute inset-0 rounded-[16px] bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
                  />
                  <div className="relative">
                    <div className="flex items-start gap-4 mb-4">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-110"
                        style={{
                          background: "linear-gradient(135deg, rgba(0,240,255,0.15), rgba(0,240,255,0.05))",
                        }}
                      >
                        <span
                          className="material-symbols-outlined text-xl"
                          style={{ color: "var(--neon-cyan)" }}
                        >
                          {feature.icon}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-foreground tracking-tight">
                          {feature.title}
                        </h3>
                        <span
                          className="inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            color: "var(--neon-cyan)",
                            background: "rgba(0,240,255,0.06)",
                          }}
                        >
                          {feature.highlight}
                        </span>
                      </div>
                    </div>
                    <p className="text-muted-foreground leading-relaxed text-sm">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
