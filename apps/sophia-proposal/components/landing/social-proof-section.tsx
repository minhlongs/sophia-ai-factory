const stats = [
  { value: "500+", label: "Missions Completed" },
  { value: "50+", label: "Agencies" },
  { value: "99.9%", label: "Uptime" },
  { value: "< 2s", label: "Response Time" },
];

const testimonials = [
  {
    initials: "MR",
    name: "Marcus Reed",
    company: "Apex Digital Agency",
    quote:
      "Sophia cut our proposal turnaround from 3 days to under 30 minutes. Our close rate jumped 40% in the first quarter.",
  },
  {
    initials: "SL",
    name: "Sophia Lin",
    company: "BrightWave Studios",
    quote:
      "The API integration was seamless. We pipe Sophia directly into our CRM and every client touchpoint is now automated.",
  },
  {
    initials: "DK",
    name: "David Kwon",
    company: "NorthBridge Consulting",
    quote:
      "We scaled from 5 to 50 clients without adding headcount. Sophia handles the content layer completely.",
  },
];

export function SocialProofSection() {
  return (
    <section className="py-20 bg-surface-container-low">
      <div className="container mx-auto px-4">
        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="text-center p-6 rounded-2xl bg-surface-container border border-outline/10"
            >
              <p className="text-3xl md:text-4xl font-bold text-primary mb-1 tracking-tight">
                {stat.value}
              </p>
              <p className="text-on-surface-variant text-sm font-medium">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Section heading */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-on-surface mb-4 tracking-tight">
            Trusted by Agencies
          </h2>
          <p className="text-xl text-on-surface-variant max-w-xl mx-auto leading-relaxed">
            See what teams are saying after switching to Sophia AI Factory
          </p>
        </div>

        {/* Testimonials */}
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="p-6 rounded-2xl bg-surface border border-outline/10 flex flex-col gap-4"
            >
              {/* Quote */}
              <p className="text-on-surface-variant leading-relaxed text-sm flex-1">
                &ldquo;{t.quote}&rdquo;
              </p>
              {/* Author */}
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container text-sm font-bold flex items-center justify-center flex-shrink-0"
                  aria-label={`Avatar for ${t.name}`}
                >
                  {t.initials}
                </div>
                <div>
                  <p className="text-on-surface font-semibold text-sm">{t.name}</p>
                  <p className="text-on-surface-variant text-xs">{t.company}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
