/**
 * White-Label Manager Color Picker Input Field.
 *
 * Layer: forest (UI component composition)
 *
 * @module forest/admin/white-label/branding-color-picker
 */

import React from 'react';
import { PRESET_SWATCHES } from './types';

interface BrandingColorPickerProps {
  label: string;
  helpText: string;
  color: string;
  onChange: (hex: string) => void;
}

export function BrandingColorPicker({
  label,
  helpText,
  color,
  onChange,
}: BrandingColorPickerProps) {
  return (
    <div className="space-y-2 p-3.5 rounded-xl border border-zinc-800 bg-zinc-950/60">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-zinc-300">{label}</label>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-zinc-400">{color}</span>
          <input
            type="color"
            value={color}
            onChange={(e) => onChange(e.target.value)}
            className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent"
          />
        </div>
      </div>
      <p className="text-[11px] text-zinc-500">{helpText}</p>
      <div className="flex items-center gap-1.5 pt-1">
        {PRESET_SWATCHES.map((swatch) => (
          <button
            key={swatch.hex}
            type="button"
            onClick={() => onChange(swatch.hex)}
            className="w-5 h-5 rounded-full border border-white/20 transition-transform hover:scale-110"
            style={{ backgroundColor: swatch.hex }}
            title={swatch.name}
          />
        ))}
      </div>
    </div>
  );
}
