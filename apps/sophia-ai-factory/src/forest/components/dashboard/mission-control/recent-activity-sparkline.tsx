'use client';
/**
 * 7-bar sparkline — pure SVG, no external chart library.
 * @module components/dashboard/mission-control/recent-activity-sparkline
 */

interface DayCount { date: string; count: number; }

interface SparklineProps {
  data: DayCount[];
  width?: number;
  height?: number;
}

const BAR_COLOR = '#7c3aed';
const ZERO_COLOR = '#3f3f46';
const GAP = 3;

export function RecentActivitySparkline({ data, width = 84, height = 32 }: SparklineProps) {
  const n = data.length;
  if (n === 0) return null;
  const max = Math.max(...data.map(d => d.count), 1);
  const barWidth = (width - GAP * (n - 1)) / n;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {data.map((d, i) => {
        const barH = d.count > 0 ? Math.max(3, (d.count / max) * height) : 3;
        const x = i * (barWidth + GAP);
        const y = height - barH;
        return (
          <rect
            key={d.date}
            x={x}
            y={y}
            width={barWidth}
            height={barH}
            rx="1"
            fill={d.count > 0 ? BAR_COLOR : ZERO_COLOR}
          />
        );
      })}
    </svg>
  );
}
