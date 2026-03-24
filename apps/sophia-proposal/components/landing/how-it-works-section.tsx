import { ScrollReveal } from "@/components/ui/scroll-reveal";

const steps = [
  {
    icon: "person_add",
    title: "Sign Up",
    description: "Create your account and receive 200 free MCU credits instantly — no credit card required.",
    color: "from-blue-500 to-cyan-500",
    bgLight: "bg-blue-500/5",
  },
  {
    icon: "rocket_launch",
    title: "Launch Mission",
    description: "Define your AI task via dashboard or API. Choose from 10+ built-in commands or create custom ones.",
    color: "from-violet-500 to-purple-500",
    bgLight: "bg-violet-500/5",
  },
  {
    icon: "task_alt",
    title: "Get Results",
    description: "Receive AI-generated output with real-time SSE streaming. Webhook delivery for async workflows.",
    color: "from-green-500 to-emerald-500",
    bgLight: "bg-green-500/5",
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-28 bg-surface">
      <div className="container mx-auto px-4">
        <ScrollReveal className="text-center mb-20">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 mb-5 text-xs font-semibold uppercase tracking-wider text-primary bg-primary/5 rounded-full border border-primary/10">
            <span className="material-symbols-outlined text-sm">play_circle</span>
            How It Works
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-on-surface mb-5 tracking-tight">
            Up and Running{" "}
            <span className="text-primary">in Minutes</span>
          </h2>
          <p className="text-lg text-on-surface-variant max-w-xl mx-auto leading-relaxed">
            Three steps from sign-up to production AI output
          </p>
        </ScrollReveal>

        <div className="relative max-w-4xl mx-auto">
          {/* Connector line — desktop only */}
          <div className="hidden md:block absolute top-[68px] left-[calc(16.67%+24px)] right-[calc(16.67%+24px)] h-[2px]">
            <div className="w-full h-full bg-gradient-to-r from-blue-500/30 via-violet-500/30 to-green-500/30 rounded-full" />
          </div>

          <div className="grid md:grid-cols-3 gap-10">
            {steps.map((step, index) => (
              <ScrollReveal key={step.title} delay={index * 150}>
                <div className="relative text-center group">
                  {/* Step number with gradient ring */}
                  <div className="relative w-16 h-16 mx-auto mb-6">
                    <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${step.color} opacity-20 group-hover:opacity-40 transition-opacity duration-300 blur-sm`} />
                    <div className={`relative w-full h-full rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-lg`}>
                      <span className="text-white text-xl font-bold">{index + 1}</span>
                    </div>
                  </div>

                  {/* Icon */}
                  <div className={`w-14 h-14 rounded-2xl ${step.bgLight} flex items-center justify-center mx-auto mb-5 group-hover:scale-110 transition-transform duration-300`}>
                    <span className="material-symbols-outlined text-2xl text-primary" aria-hidden="true">
                      {step.icon}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-on-surface mb-3 tracking-tight">
                    {step.title}
                  </h3>
                  <p className="text-on-surface-variant leading-relaxed text-sm max-w-xs mx-auto">
                    {step.description}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
