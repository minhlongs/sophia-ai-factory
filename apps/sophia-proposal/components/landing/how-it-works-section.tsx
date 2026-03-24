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
    <section id="how-it-works" className="py-20 bg-surface-container-low">
      <div className="container mx-auto px-4">
        {/* Heading */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-on-surface mb-4 tracking-tight">
            How It Works
          </h2>
          <p className="text-xl text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
            From sign-up to AI output in three simple steps
          </p>
        </div>

        {/* Steps */}
        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-center gap-0">
          {steps.map((step, index) => (
            <div key={step.step} className="flex flex-col md:flex-row items-center flex-1 min-w-0">
              {/* Step card */}
              <div className="flex flex-col items-center text-center px-6 py-8 max-w-xs mx-auto">
                {/* Step badge */}
                <div className="w-8 h-8 rounded-full bg-primary text-on-primary text-sm font-bold flex items-center justify-center mb-4">
                  {step.step}
                </div>
                {/* Icon */}
                <div className="w-16 h-16 rounded-2xl bg-primary-container flex items-center justify-center mb-5">
                  <span
                    className="material-symbols-outlined text-3xl text-on-primary-container"
                    aria-hidden="true"
                  >
                    {step.icon}
                  </span>
                </div>
                <h3 className="text-xl font-semibold text-on-surface mb-2 tracking-tight">
                  {step.title}
                </h3>
                <p className="text-on-surface-variant leading-relaxed text-sm">
                  {step.description}
                </p>
              </div>

              {/* Connector — hidden after last step */}
              {index < steps.length - 1 && (
                <div className="hidden md:flex items-center justify-center flex-shrink-0 w-12">
                  <div className="w-full h-0.5 bg-outline/30 relative">
                    <span
                      className="material-symbols-outlined text-outline/50 text-sm absolute -top-2.5 left-1/2 -translate-x-1/2"
                      aria-hidden="true"
                    >
                      arrow_forward
                    </span>
                  </div>
                </div>
              )}
              {/* Mobile connector */}
              {index < steps.length - 1 && (
                <div className="md:hidden flex flex-col items-center h-8">
                  <div className="w-0.5 h-full bg-outline/30" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
