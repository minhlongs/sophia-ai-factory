"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FaqItem {
  question: string;
  answer: string;
}

interface GuideAccordionFaqProps {
  items: FaqItem[];
  className?: string;
}

export function GuideAccordionFaq({ items, className }: GuideAccordionFaqProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className={cn("space-y-2", className)}>
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <div
            key={index}
            className={cn(
              "border rounded-xl overflow-hidden transition-colors",
              isOpen
                ? "border-violet-500/40 bg-violet-500/5"
                : "border-border/40 bg-card/50 hover:border-border/70"
            )}
          >
            <button
              onClick={() => setOpenIndex(isOpen ? null : index)}
              className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
              aria-expanded={isOpen}
            >
              <span className="text-sm font-medium text-foreground leading-snug">
                {item.question}
              </span>
              <span className="shrink-0">
                {isOpen
                  ? <Minus className="w-4 h-4 text-violet-400" aria-hidden="true" />
                  : <Plus className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                }
              </span>
            </button>
            {isOpen && (
              <div className="px-5 pb-4">
                <p className="text-sm text-muted-foreground leading-relaxed border-t border-border/30 pt-3">
                  {item.answer}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
