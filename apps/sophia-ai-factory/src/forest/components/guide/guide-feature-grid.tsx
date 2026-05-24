import { cn } from '@/seed/utils/cn';
import { LucideIcon } from "lucide-react";

export interface GuideFeatureItem {
  icon: LucideIcon;
  title: string;
  description: string;
  iconColor?: string;
}

interface GuideFeatureGridProps {
  features: GuideFeatureItem[];
  columns?: 2 | 3;
  className?: string;
}

export function GuideFeatureGrid({ features, columns = 2, className }: GuideFeatureGridProps) {
  return (
    <div className={cn(
      "grid gap-4",
      columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3",
      className
    )}>
      {features.map((feature, index) => {
        const Icon = feature.icon;
        return (
          <div
            key={index}
            className="bg-card/50 border border-border/40 rounded-xl p-5 hover:border-border/70 transition-colors"
          >
            <div className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center mb-3 bg-violet-500/10",
              feature.iconColor ? "" : "text-violet-400"
            )}>
              <Icon className={cn("w-5 h-5", feature.iconColor ?? "text-violet-400")} />
            </div>
            <h3 className="text-sm font-semibold text-foreground mb-1">{feature.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
          </div>
        );
      })}
    </div>
  );
}
