/**
 * White-Label Manager Image URL Field with Preview.
 *
 * Layer: forest (UI component composition)
 *
 * @module forest/admin/white-label/branding-image-field
 */

import React from 'react';

interface BrandingImageFieldProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  imageAlt: string;
}

export function BrandingImageField({
  label,
  value,
  onChange,
  placeholder,
  imageAlt,
}: BrandingImageFieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-zinc-300">{label}</label>
      <div className="flex items-center gap-3">
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {value && (
          <div className="w-10 h-10 rounded-xl border border-zinc-800 bg-zinc-950 p-1 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt={imageAlt}
              className="max-w-full max-h-full object-contain"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
