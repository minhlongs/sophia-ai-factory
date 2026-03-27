import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface GuideStepCardProps {
  step: number;
  title: string;
  description: ReactNode;
  code?: string;
  className?: string;
}

export function GuideStepCard({ step, title, description, code, className }: GuideStepCardProps) {
  return (
    <div className={cn(
      "bg-card/50 border border-border/40 rounded-xl p-6 hover:border-border/70 transition-colors",
      className
    )}>
      <div className="flex items-start gap-4">
        {/* Step badge */}
        <div className="shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-white text-sm font-bold shadow-lg">
          {step}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>
          <div className="text-sm text-muted-foreground leading-relaxed">{description}</div>
          {code && (
            <div className="mt-3 bg-muted/30 border border-border/40 rounded-lg px-4 py-2.5 font-mono text-sm text-cyan-400 break-all">
              {code}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
