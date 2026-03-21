"use client";

const features = [
  {
    icon: "flash_on",
    title: "Lightning Fast",
    description: "Optimized performance with edge deployment and automatic code splitting.",
  },
  {
    icon: "shield",
    title: "Secure by Default",
    description: "Enterprise-grade security with built-in authentication and authorization.",
  },
  {
    icon: "auto_awesome",
    title: "AI-Powered",
    description: "Intelligent automation for repetitive tasks and smart decision-making.",
  },
  {
    icon: "trending_up",
    title: "Scalable Growth",
    description: "Built to scale from startup to enterprise with zero infrastructure worries.",
  },
];

export function FeaturesSection() {
  return (
    <section className="py-20 bg-surface">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-on-surface mb-4 tracking-tight">
            Why Sophia?
          </h2>
          <p className="text-xl text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
            Everything you need to build production-ready AI applications
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-2xl bg-surface-container-low hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-5xl text-primary mb-4 block">
                {feature.icon}
              </span>
              <h3 className="text-xl font-semibold text-on-surface mb-2 tracking-tight">
                {feature.title}
              </h3>
              <p className="text-on-surface-variant leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
