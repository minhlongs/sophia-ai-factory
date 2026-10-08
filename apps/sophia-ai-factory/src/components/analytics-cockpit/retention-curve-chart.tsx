/**
 * Retention Curve Chart Component
 * Interactive SVG visualizing video drop-off curve and the 3-second hook threshold.
 *
 * Layer: UI Component | File size: < 200 LOC | Zero :any.
 * @module components/analytics-cockpit/retention-curve-chart
 */

'use client';

import React from 'react';
import { Activity, ShieldAlert, Sparkles } from 'lucide-react';

interface RetentionCurveProps {
  threeSecRate?: number;
  q1Rate?: number;
  completionRate?: number;
}

export function RetentionCurveChart({
  threeSecRate = 0.78,
  q1Rate = 0.62,
  completionRate = 0.44,
}: RetentionCurveProps) {
  // SVG points calculated from normalized rates
  const p0 = { x: 40, y: 30 }; // Start: 100%
  const p1 = { x: 120, y: 190 - Math.round(threeSecRate * 160) }; // 3s
  const p2 = { x: 220, y: 190 - Math.round(q1Rate * 160) }; // 25% duration
  const p3 = { x: 340, y: 190 - Math.round((q1Rate * 0.8) * 160) }; // 50%
  const p4 = { x: 440, y: 190 - Math.round(completionRate * 160) }; // 100%

  const pathD = `M ${p0.x} ${p0.y} C 80 ${p0.y}, 90 ${p1.y}, ${p1.x} ${p1.y} S 180 ${p2.y}, ${p2.x} ${p2.y} S 280 ${p3.y}, ${p3.x} ${p3.y} S 400 ${p4.y}, ${p4.x} ${p4.y}`;
  const areaD = `${pathD} L ${p4.x} 190 L ${p0.x} 190 Z`;

  return (
    <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-md p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-white">Biểu Đồ Giữ Chân Khán Giả / Audience Retention Curve</h3>
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> 3s Hook Critical Zone
        </span>
      </div>

      <div className="w-full relative h-[190px]">
        <svg viewBox="0 0 480 200" className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="retentionGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="25%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#818cf8" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1="40" y1="30" x2="450" y2="30" stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
          <line x1="40" y1="80" x2="450" y2="80" stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
          <line x1="40" y1="130" x2="450" y2="130" stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
          <line x1="40" y1="180" x2="450" y2="180" stroke="rgba(255,255,255,0.15)" />

          {/* 3s Hook threshold marker zone */}
          <rect x="40" y="20" width="80" height="160" fill="rgba(245, 158, 11, 0.05)" />
          <line x1="120" y1="20" x2="120" y2="180" stroke="rgba(245, 158, 11, 0.4)" strokeDasharray="2 2" />

          {/* Area under curve */}
          <path d={areaD} fill="url(#retentionGrad)" />

          {/* Spline curve */}
          <path d={pathD} fill="none" stroke="url(#lineGrad)" strokeWidth="3" strokeLinecap="round" />

          {/* Key data nodes */}
          <circle cx={p0.x} cy={p0.y} r="4" fill="#f59e0b" />
          <circle cx={p1.x} cy={p1.y} r="5" fill="#f59e0b" stroke="#000" strokeWidth="2" />
          <circle cx={p2.x} cy={p2.y} r="4" fill="#eab308" />
          <circle cx={p4.x} cy={p4.y} r="4" fill="#818cf8" />

          {/* Labels */}
          <text x={p1.x} y={p1.y - 10} fill="#f59e0b" fontSize="10" fontWeight="bold" textAnchor="middle">
            {(threeSecRate * 100).toFixed(0)}% (3s)
          </text>
          <text x={p4.x} y={p4.y - 10} fill="#818cf8" fontSize="10" textAnchor="middle">
            {(completionRate * 100).toFixed(0)}% Full
          </text>
        </svg>
      </div>

      <div className="flex items-center justify-between text-[11px] text-white/50 border-t border-white/5 pt-2 mt-2">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
          Vùng Quyết Định 3s (Tỷ lệ thoát: {((1 - threeSecRate) * 100).toFixed(0)}%)
        </span>
        <span className="font-mono text-emerald-400">
          Hoàn thành Video: {(completionRate * 100).toFixed(1)}%
        </span>
      </div>
    </div>
  );
}
