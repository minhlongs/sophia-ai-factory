/**
 * Inline SVG Sparkline Generator
 * Layer: tree/partners
 *
 * @module tree/partners/export/sparkline-generator
 */

import type { SparklineOptions } from './types';

/**
 * Generates an edge-compatible inline SVG sparkline graph from an array of numbers.
 * Scales x and y coordinates dynamically with gradient area fill and terminal marker dot.
 */
export function generateSvgSparkline(
  dataPoints: number[],
  options: SparklineOptions = {},
): string {
  const width = options.width ?? 120;
  const height = options.height ?? 32;
  const strokeColor = options.strokeColor ?? '#06b6d4';
  const fillColor = options.fillColor ?? strokeColor;
  const strokeWidth = options.strokeWidth ?? 2;

  if (!dataPoints || dataPoints.length === 0) {
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="sparkline" xmlns="http://www.w3.org/2000/svg"><line x1="0" y1="${height / 2}" x2="${width}" y2="${height / 2}" stroke="#cbd5e1" stroke-dasharray="3 3" /></svg>`;
  }

  if (dataPoints.length === 1) {
    const y = height / 2;
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="sparkline" xmlns="http://www.w3.org/2000/svg"><line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="${strokeColor}" stroke-width="${strokeWidth}" /><circle cx="${width / 2}" cy="${y}" r="3" fill="${strokeColor}" /></svg>`;
  }

  const min = Math.min(...dataPoints);
  const max = Math.max(...dataPoints);
  const range = max - min || 1;
  const padding = 4;
  const usableHeight = height - padding * 2;

  const points: Array<{ x: number; y: number }> = dataPoints.map((val, idx) => {
    const x = Number(((idx / (dataPoints.length - 1)) * (width - padding * 2) + padding).toFixed(1));
    const normalizedY = (val - min) / range;
    const y = Number(((height - padding) - normalizedY * usableHeight).toFixed(1));
    return { x, y };
  });

  const pathD = points.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;
  const lastPoint = points[points.length - 1];

  const gradientId = `spk_grad_${Math.abs(dataPoints.reduce((a, b) => a + b, 0)).toString(36).slice(0, 6)}`;

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="sparkline" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${fillColor}" stop-opacity="0.3" />
      <stop offset="100%" stop-color="${fillColor}" stop-opacity="0.0" />
    </linearGradient>
  </defs>
  <path d="${areaD}" fill="url(#${gradientId})" />
  <path d="${pathD}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" />
  <circle cx="${lastPoint.x}" cy="${lastPoint.y}" r="3.5" fill="${strokeColor}" />
</svg>`;
}
