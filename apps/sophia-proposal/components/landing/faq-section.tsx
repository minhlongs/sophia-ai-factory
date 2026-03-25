"use client";

import { useState } from "react";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "What is an MCU credit?",
    answer:
      "MCU stands for Mission Compute Unit. Each AI task consumes MCUs based on its complexity — a short email draft costs fewer MCUs than a full 12-page proposal. This lets you pay precisely for what you use instead of a flat per-task fee.",
  },
  {
    question: "Do I need technical skills to use Sophia?",
    answer:
      "No technical skills required. Use the intuitive dashboard to run AI missions with a few clicks. Developers can also integrate via our REST API or SDK for deeper automation workflows.",
  },
  {
    question: "What AI models power Sophia?",
    answer:
      "Sophia is powered by Claude by Anthropic for reasoning and writing tasks. We also use multi-provider model routing to ensure reliability — if one provider has downtime, your missions keep running without interruption.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes, absolutely. There is no lock-in contract. You can downgrade to a lower tier or cancel your subscription at any time directly from your dashboard. Unused MCU credits are valid for 12 months.",
  },
  {
    question: "Is my data secure?",
    answer:
      "Security is a top priority. Sophia is SOC 2 Type II compliant, all data is encrypted at rest (AES-256) and in transit (TLS 1.3). We are GDPR-ready with data residency options in EU and US regions.",
  },
  {
    question: "What commands are available?",
    answer:
      "Sophia currently ships 17 AI commands across 6 categories: proposals (proposal:create, proposal:revise), content (content:write, content:repurpose), sales (sales:battlecard, email:send, email:sequence), lead generation (lead:generate, lead:enrich), video (video:proposal, video:explainer), and analytics (analytics:report, analytics:forecast, analytics:sentiment). More commands ship monthly.",
  },
];

interface AccordionItemProps {
  item: FaqItem;
  isOpen: boolean;
  onToggle: () => void;
  index: number;
}

function AccordionItem({ item, isOpen, onToggle, index }: AccordionItemProps) {
  return (
    <div className="border-b border-outline/20 last:border-0">
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between gap-4 py-5 text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-sm"
      >
        <span className="flex items-center gap-3 text-on-surface font-medium text-base group-hover:text-primary transition-colors duration-200">
          <span className="shrink-0 w-7 h-7 rounded-full bg-primary/8 flex items-center justify-center text-xs font-bold text-primary">
            {index + 1}
          </span>
          {item.question}
        </span>
        <span
          className="material-symbols-outlined text-on-surface-variant shrink-0 transition-transform duration-300"
          style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          expand_more
        </span>
      </button>

      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: isOpen ? "400px" : "0px", opacity: isOpen ? 1 : 0 }}
      >
        <p className="pb-5 pl-10 text-on-surface-variant leading-relaxed text-sm">
          {item.answer}
        </p>
      </div>
    </div>
  );
}

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const handleToggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="py-28 bg-surface-container-low">
      <div className="container mx-auto px-4">
        <ScrollReveal className="text-center mb-14">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 mb-5 text-xs font-semibold uppercase tracking-wider text-primary bg-primary/5 rounded-full border border-primary/10">
            <span className="material-symbols-outlined text-sm">help</span>
            FAQ
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-on-surface mb-5 tracking-tight">
            Common{" "}
            <span className="text-primary">Questions</span>
          </h2>
          <p className="text-lg text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
            Everything you need to know before getting started.
          </p>
        </ScrollReveal>

        <ScrollReveal>
          <div className="max-w-3xl mx-auto bg-surface-container-lowest rounded-2xl px-8 py-2 border border-outline/10">
            {FAQ_ITEMS.map((item, index) => (
              <AccordionItem
                key={item.question}
                item={item}
                isOpen={openIndex === index}
                onToggle={() => handleToggle(index)}
                index={index}
              />
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
