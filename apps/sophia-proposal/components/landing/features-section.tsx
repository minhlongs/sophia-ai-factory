"use client";

import { ScrollReveal } from "@/components/ui/scroll-reveal";

const features = [
  {
    icon: "smart_toy",
    title: "AI Mission Engine",
    description: "Deploy autonomous AI agents that execute complex multi-step tasks — from proposal generation to content creation.",
    highlight: "Plan → Execute → Verify",
    span: "md:col-span-2",
    gradient: "from-blue-500/20 to-cyan-500/10",
  },
  {
    icon: "toll",
    title: "MCU Credits",
    description: "Pay only for what you use. Transparent, predictable billing with no hidden fees or surprises.",
    highlight: "Usage-based pricing",
    span: "",
    gradient: "from-amber-500/20 to-orange-500/10",
  },
  {
    icon: "api",
    title: "Developer-First API",
    description: "RESTful API with real-time SSE streaming, webhook callbacks, and TypeScript SDK.",
    highlight: "Integrate in 5 minutes",
    span: "",
    gradient: "from-green-500/20 to-emerald-500/10",
  },
  {
    icon: "speed",
    title: "Edge Performance",
    description: "Global Cloudflare Workers deployment. Sub-2s response times with 99.9% uptime SLA guarantee.",
    highlight: "250+ edge locations",
    span: "md:col-span-2",
    gradient: "from-purple-500/20 to-violet-500/10",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-28 bg-surface-container-low">
      <div className="container mx-auto px-4">
        <ScrollReveal className="text-center mb-20">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 mb-5 text-xs font-semibold uppercase tracking-wider text-primary bg-primary/5 rounded-full border border-primary/10">
            <span className="material-symbols-outlined text-sm">category</span>
            Platform
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-on-surface mb-5 tracking-tight">
            Built for Agencies,{" "}
            <span className="text-primary">Powered by AI</span>
          </h2>
          <p className="text-lg text-on-surface-variant max-w-xl mx-auto leading-relaxed">
            Everything you need to automate AI workflows at scale
          </p>
        </ScrollReveal>

        {/* Bento Grid */}
        <div className="grid md:grid-cols-4 gap-4 max-w-5xl mx-auto">
          {features.map((feature, i) => (
            <ScrollReveal key={feature.title} delay={i * 100} className={feature.span}>
              <div className="group gradient-border h-full cursor-pointer">
                <div className="relative h-full p-7 rounded-[16px] bg-surface-container-lowest">
                  {/* Hover gradient glow */}
                  <div className={`absolute inset-0 rounded-[16px] bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                  <div className="relative">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center flex-shrink-0 group-hover:from-primary/25 group-hover:to-primary/10 transition-all duration-300 group-hover:scale-110">
                        <span className="material-symbols-outlined text-xl text-primary">
                          {feature.icon}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-on-surface tracking-tight">
                          {feature.title}
                        </h3>
                        <span className="inline-block mt-1 text-xs text-primary font-semibold bg-primary/5 px-2 py-0.5 rounded-full">
                          {feature.highlight}
                        </span>
                      </div>
                    </div>
                    <p className="text-on-surface-variant leading-relaxed text-sm">
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
