/** Sub-components for ProductionCostCalculator — extracted to stay under 200 lines */

/** Slider input with label + value display */
export function SliderInput({
  label, value, min, max, onChange, step = 1,
}: {
  label: string; value: number; min: number; max: number;
  onChange: (v: number) => void; step?: number;
}) {
  const id = `slider-${label.replace(/\s/g, '-').toLowerCase()}`;
  return (
    <div>
      <div className="flex justify-between mb-2">
        <label htmlFor={id} className="text-foreground/80 text-sm">{label}</label>
        <span className="text-[var(--neon-cyan)] font-bold">{value}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer slider-cyan"
      />
      <div className="flex justify-between text-xs text-muted-foreground mt-1">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

/** Single cost row */
export function CostRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className={highlight ? "text-foreground font-semibold" : "text-foreground/70 text-sm"}>{label}</span>
      <span className={highlight ? "text-[var(--neon-cyan)] font-bold text-lg" : "text-foreground font-medium"}>{value}</span>
    </div>
  );
}

/** Metric card */
export function MetricCard({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="text-center p-3 bg-white/5 rounded-lg">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{unit}</p>
    </div>
  );
}

/** Format number with commas */
export function fmt(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** Format as USD */
export function fmtUSD(n: number): string {
  return `$${fmt(n)}`;
}
