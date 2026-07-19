interface CreditMeterDisplayProps {
  used: number
  total: number
}

export function CreditMeterDisplay({ used, total }: CreditMeterDisplayProps) {
  const remaining = total - used
  const fillPct = total > 0 ? (used / total) * 100 : 0

  let barColor = 'bg-emerald-500'
  const pct = total > 0 ? (remaining / total) * 100 : 0
  if (pct <= 10) barColor = 'bg-red-500'
  else if (pct <= 30) barColor = 'bg-amber-500'

  return (
    <div className="w-full">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-muted-foreground">{remaining.toLocaleString()} / {total.toLocaleString()} credits</span>
        <span className={`font-medium ${barColor === 'bg-red-500' ? 'text-red-500' : barColor === 'bg-amber-500' ? 'text-amber-500' : 'text-emerald-500'}`}>{pct.toFixed(0)}% left</span>
      </div>
      <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${fillPct}%` }} />
      </div>
    </div>
  )
}
