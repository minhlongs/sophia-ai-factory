"use client";

import { ScrollReveal } from "@/components/ui/scroll-reveal";

const features = [
  {
    icon: "smart_toy",
    title: "AI Mission Engine",
    description: "Deploy autonomous AI agents that execute complex multi-step tasks — from proposal generation to content creation.",
    highlight: "Multi-step autonomous execution",
    span: "md:col-span-2",
  },
  {
    icon: "toll",
    title: "MCU Credit System",
    description: "Pay only for what you use. Transparent, predictable billing with no hidden fees.",
    highlight: "Usage-based pricing",
    span: "",
  },
  {
    icon: "api",
    title: "Developer-First API",
    description: "RESTful API with real-time streaming, webhook callbacks, and SDK support.",
    highlight: "Integrate in minutes",
    span: "",
  },
  {
    icon: "speed",
    title: "Edge Performance",
    description: "Global Cloudflare Workers deployment. Sub-2s response times with 99.9% uptime guarantee.",
    highlight: "250+ edge locations",
    span: "md:col-span-2",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 bg-gray-50">
      <div className="container mx-auto px-4">
        <ScrollReveal className="text-center mb-16">
          <span className="inline-block px-4 py-1.5 mb-4 text-xs font-semibold uppercase tracking-wider text-primary bg-primary/5 rounded-full">
            Platform
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-on-surface mb-4 tracking-tight">
            Built for Agencies, Powered by AI
          </h2>
          <p className="text-lg text-on-surface-variant max-w-xl mx-auto leading-relaxed">
            Everything you need to automate AI workflows at scale
          </p>
        </ScrollReveal>

        {/* Bento Grid — 2 large + 2 small on desktop */}
        <div className="grid md:grid-cols-4 gap-4 max-w-5xl mx-auto">
          {features.map((feature, i) => (
            <ScrollReveal key={feature.title} delay={i * 100} className={feature.span}>
              <div className="group h-full p-7 rounded-2xl bg-white border border-gray-100 card-hover cursor-pointer">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center flex-shrink-0 group-hover:from-primary/20 group-hover:to-primary/10 transition-colors">
                    <span className="material-symbols-outlined text-xl text-primary">
                      {feature.icon}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-on-surface tracking-tight">
                      {feature.title}
                    </h3>
                    <span className="text-xs text-primary font-medium">{feature.highlight}</span>
                  </div>
                </div>
                <p className="text-on-surface-variant leading-relaxed text-sm">
                  {feature.description}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
