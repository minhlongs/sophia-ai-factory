import { cn } from '@/seed/utils/cn';

interface GuideCommandCardProps {
  command: string;
  description: string;
  example?: string;
  mcuCost?: string;
  className?: string;
}

export function GuideCommandCard({
  command,
  description,
  example,
  mcuCost,
  className,
}: GuideCommandCardProps) {
  return (
    <div className={cn(
      "bg-card/50 border border-border/40 rounded-xl p-5 hover:border-border/70 transition-colors",
      className
    )}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="font-mono text-accent font-semibold text-sm bg-accent/10 px-2.5 py-1 rounded-md border border-accent/20">
          {command}
        </span>
        {mcuCost && (
          <span className="shrink-0 text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-medium">
            {mcuCost} MCU
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed mb-2">{description}</p>
      {example && (
        <div className="mt-2 bg-muted/30 border border-border/30 rounded-lg px-3 py-2 font-mono text-xs text-muted-foreground/80">
          <span className="text-muted-foreground/50 mr-1.5">Ví dụ:</span>
          {example}
        </div>
      )}
    </div>
  );
}
