import { cn } from '@/seed/utils/cn';

function Skeleton({
  className,
  shimmer = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { shimmer?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-md",
        shimmer ? "animate-shimmer" : "motion-safe:animate-pulse bg-muted",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
