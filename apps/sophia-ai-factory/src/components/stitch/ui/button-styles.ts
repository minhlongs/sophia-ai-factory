export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export const BUTTON_BASE_STYLES = `
  inline-flex items-center justify-center gap-sm
  font-semibold
  rounded-xl transition-all duration-200
  active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed
  focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1
`;

export const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: `
    bg-primary text-primary-foreground
    hover:bg-primary/90
    shadow-md hover:shadow-lg
    border border-primary/20
  `,
  secondary: `
    bg-card dark:bg-card text-foreground border border-border dark:border-white/[0.08]
    hover:bg-muted dark:hover:bg-white/10 hover:border-primary/30
  `,
  outline: `
    bg-transparent border border-border dark:border-white/[0.08] text-foreground
    hover:bg-muted/50 dark:hover:bg-white/5 hover:border-primary/40
  `,
  ghost: `
    bg-transparent text-muted-foreground dark:text-slate-300
    hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground dark:hover:text-white
  `,
  destructive: `
    bg-rose-600 text-white
    hover:bg-rose-500 shadow-md shadow-rose-600/25
  `,
};

export const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1 text-label-sm h-8 min-h-[36px] sm:min-h-0',
  md: 'px-4 py-2 text-label-md h-10',
  lg: 'px-6 py-2.5 text-label-lg h-12',
};

export function resolveButtonClasses(params: {
  variant: ButtonVariant;
  size: ButtonSize;
  fullWidth: boolean;
  isLinkDisabled?: boolean;
  className?: string;
}): string {
  const { variant, size, fullWidth, isLinkDisabled = false, className = '' } = params;
  return [
    BUTTON_BASE_STYLES,
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    fullWidth ? 'w-full' : '',
    isLinkDisabled && 'opacity-50 pointer-events-none cursor-not-allowed',
    className,
  ]
    .filter(Boolean)
    .join(' ');
}
