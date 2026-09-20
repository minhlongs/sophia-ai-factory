/**
 * Server Component for SSR Theme Variable Injection.
 * Renders an inline <style> tag with CSP nonce to prevent Flash of Unstyled Content (FOUC).
 *
 * Layer: forest (UI component composition)
 * Allowed imports: react, @/seed/*, @/tree/*
 *
 * @module forest/theme/white-label-theme-style
 */

import React from 'react';

export interface WhiteLabelThemeStyleProps {
  themeCss: string | null;
  nonce?: string;
}

export function WhiteLabelThemeStyle({ themeCss, nonce }: WhiteLabelThemeStyleProps) {
  if (!themeCss) return null;

  // Defensively escape any </style sequences to prevent SSR HTML style tag breakout
  const sanitizedCss = themeCss.replace(/<\/style/gi, '<\\/style');

  return (
    <style
      id="whitelabel-brand-theme"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: sanitizedCss }}
    />
  );
}
