const steps = [
  {
    icon: "person_add",
    title: "Sign Up",
    description: "Create your account and receive 200 free MCU credits instantly — no credit card required.",
    step: 1,
  },
  {
    icon: "rocket_launch",
    title: "Launch Mission",
    description: "Define your AI task via our intuitive dashboard or integrate directly through the API.",
    step: 2,
  },
  {
    icon: "task_alt",
    title: "Get Results",
    description: "Receive AI-generated output with real-time streaming and structured delivery.",
    step: 3,
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24 bg-gradient-to-b from-white to-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1.5 mb-4 text-xs font-semibold uppercase tracking-wider text-primary bg-primary/5 rounded-full">
            Simple Setup
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-on-surface mb-4 tracking-tight">
            Up and Running in Minutes
          </h2>
          <p className="text-lg text-on-surface-variant max-w-xl mx-auto leading-relaxed">
            Three steps from sign-up to production AI output
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {steps.map((step, index) => (
            <div key={step.step} className="relative text-center">
              {/* Number badge */}
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-[#5ec9ff] text-white text-xl font-bold flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary/20">
                {step.step}
              </div>
              {/* Icon */}
              <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center mx-auto mb-5">
                <span className="material-symbols-outlined text-3xl text-primary" aria-hidden="true">
                  {step.icon}
                </span>
              </div>
              <h3 className="text-xl font-semibold text-on-surface mb-2 tracking-tight">
                {step.title}
              </h3>
              <p className="text-on-surface-variant leading-relaxed text-sm max-w-xs mx-auto">
                {step.description}
              </p>
              {/* Connector line (desktop only) */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-7 left-[calc(50%+40px)] w-[calc(100%-80px)] h-0.5 bg-gradient-to-r from-primary/30 to-primary/10" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
