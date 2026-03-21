"use client";

const features = [
  {
    icon: "edit_note",
    title: "Automated Proposal Writing",
    description:
      "Generate professional proposals in minutes with AI-powered content creation tailored to your client's needs.",
  },
  {
    icon: "psychology",
    title: "AI-Powered Insights",
    description:
      "Get intelligent recommendations on pricing, positioning, and strategy based on market data and win rates.",
  },
  {
    icon: "description",
    title: "Custom Templates",
    description:
      "Choose from industry-specific templates or create your own branded templates for consistent proposals.",
  },
];

export function ProposalGeneratorSection() {
  return (
    <section className="py-20 bg-surface-container-low">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-on-surface mb-4 tracking-tight">
            AI Proposal Generator
          </h2>
          <p className="text-xl text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
            Create winning proposals faster with AI assistance
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-2xl bg-surface hover:bg-surface-container-high transition-colors"
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
