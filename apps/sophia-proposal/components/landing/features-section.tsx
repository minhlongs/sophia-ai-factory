"use client";

const features = [
  {
    icon: "smart_toy",
    title: "AI Mission Engine",
    description:
      "Deploy autonomous AI agents that execute complex multi-step tasks — from proposal generation to content creation.",
  },
  {
    icon: "toll",
    title: "MCU Credit System",
    description:
      "Pay only for what you use. Mission Credit Units (MCU) provide transparent, predictable billing with no hidden fees.",
  },
  {
    icon: "api",
    title: "Developer-First API",
    description:
      "RESTful API with real-time streaming, webhook callbacks, and SDK support. Integrate AI capabilities in minutes.",
  },
  {
    icon: "speed",
    title: "Edge-Deployed Performance",
    description:
      "Global Cloudflare Workers deployment ensures sub-2s response times with 99.9% uptime guarantee.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 bg-surface">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-on-surface mb-4 tracking-tight">
            Built for Agencies, Powered by AI
          </h2>
          <p className="text-xl text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
            Everything you need to automate AI workflows at scale
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group p-6 rounded-2xl bg-white border border-gray-100 card-hover cursor-pointer"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors">
                <span className="material-symbols-outlined text-2xl text-primary">
                  {feature.icon}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-on-surface mb-2 tracking-tight">
                {feature.title}
              </h3>
              <p className="text-on-surface-variant leading-relaxed text-sm">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
