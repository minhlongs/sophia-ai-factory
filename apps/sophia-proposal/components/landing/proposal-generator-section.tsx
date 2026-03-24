"use client";

import { ScrollReveal } from "@/components/ui/scroll-reveal";

const features = [
  {
    icon: "edit_note",
    title: "Automated Proposals",
    description: "Generate professional proposals in minutes with AI content tailored to your client's needs and industry.",
    color: "text-blue-500",
    bg: "bg-blue-500/8",
  },
  {
    icon: "psychology",
    title: "AI-Powered Insights",
    description: "Get intelligent recommendations on pricing, positioning, and strategy based on market data and win rates.",
    color: "text-violet-500",
    bg: "bg-violet-500/8",
  },
  {
    icon: "description",
    title: "Custom Templates",
    description: "Choose from industry-specific templates or create your own branded templates for consistent proposals.",
    color: "text-emerald-500",
    bg: "bg-emerald-500/8",
  },
];

export function ProposalGeneratorSection() {
  return (
    <section className="py-28 bg-surface-container-low">
      <div className="container mx-auto px-4">
        <ScrollReveal className="text-center mb-20">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 mb-5 text-xs font-semibold uppercase tracking-wider text-primary bg-primary/5 rounded-full border border-primary/10">
            <span className="material-symbols-outlined text-sm">auto_awesome</span>
            AI Proposals
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-on-surface mb-5 tracking-tight">
            Win More Deals{" "}
            <span className="text-primary">Faster</span>
          </h2>
          <p className="text-lg text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
            Create winning proposals with AI assistance — from research to delivery
          </p>
        </ScrollReveal>

        <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {features.map((feature, i) => (
            <ScrollReveal key={feature.title} delay={i * 100}>
              <div className="gradient-border h-full cursor-pointer group">
                <div className="p-7 rounded-[16px] bg-surface-container-lowest h-full">
                  <div className={`w-14 h-14 rounded-2xl ${feature.bg} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                    <span className={`material-symbols-outlined text-2xl ${feature.color}`}>
                      {feature.icon}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-on-surface mb-3 tracking-tight">
                    {feature.title}
                  </h3>
                  <p className="text-on-surface-variant leading-relaxed text-sm">{feature.description}</p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
